/**
 * Lab services (CONTEXT.md §4.6, §12). Ingest a panel via the labs adapter
 * (mock or file import), persist panel + markers, and attach a plain-English
 * AI explanation.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { labs, labMarkers, connections, type Lab, type LabMarker } from "../db/schema";
import { getLabsAdapter, type LabIngestInput } from "../adapters";
import { extractPdfText, heuristicLabFromText } from "../adapters/pdf";
import { explainLab as aiExplainLab, flagFor } from "./ai";
import { getProvider } from "./ai/provider";
import { logAction } from "./audit";
import { hasLLM } from "../config";
import { optimalFor } from "../lab-reference";
import type { AdapterKind, RawLabPanel } from "../types";

async function ensureLabConnection(userId: string, adapter: AdapterKind): Promise<string> {
  const [existing] = await db
    .select()
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.kind, "lab")));
  if (existing) return existing.id;
  const [conn] = await db
    .insert(connections)
    .values({
      userId,
      kind: "lab",
      adapter,
      status: "connected",
      label: "Labs",
      config: {},
      lastSyncedAt: new Date(),
    })
    .returning();
  return conn.id;
}

/** Persist parsed panels + markers and attach an AI explanation to each. */
export async function storeLabPanels(
  userId: string,
  panels: RawLabPanel[],
  adapter: AdapterKind,
): Promise<Lab[]> {
  const connId = await ensureLabConnection(userId, adapter);
  const created: Lab[] = [];
  for (const panel of panels) {
    // Drop any marker without a finite numeric value (bad CSV/PDF rows).
    const markers = panel.markers.filter((m) => Number.isFinite(m.value));
    const [lab] = await db
      .insert(labs)
      .values({
        userId,
        panelName: panel.panelName,
        collectedAt: new Date(panel.collectedAt),
        sourceConnectionId: connId,
      })
      .returning();

    await db.insert(labMarkers).values(
      markers.map((m) => {
        const opt = optimalFor(m.code, m.display);
        return {
          labId: lab.id,
          code: m.code,
          display: m.display,
          value: m.value,
          unit: m.unit,
          refLow: m.refLow ?? null,
          refHigh: m.refHigh ?? null,
          optimalLow: opt?.low ?? null,
          optimalHigh: opt?.high ?? null,
          flag: flagFor({ ...m, refLow: m.refLow ?? null, refHigh: m.refHigh ?? null }),
        };
      }),
    );

    const explanation = await aiExplainLab({
      panelName: panel.panelName,
      collectedAt: panel.collectedAt,
      markers: markers.map((m) => ({
        code: m.code,
        display: m.display,
        value: m.value,
        unit: m.unit,
        refLow: m.refLow ?? null,
        refHigh: m.refHigh ?? null,
      })),
    });
    await db.update(labs).set({ explanationMd: explanation }).where(eq(labs.id, lab.id));
    created.push({ ...lab, explanationMd: explanation });
  }
  return created;
}

export async function ingestLab(userId: string, input: LabIngestInput): Promise<Lab[]> {
  const adapter: AdapterKind = input.kind === "file" ? "file" : "mock";
  const panels = await getLabsAdapter(adapter).ingest(input);
  const created = await storeLabPanels(userId, panels, adapter);
  await logAction(userId, "lab.ingest", { count: created.length, source: input.kind });
  return created;
}

/** LLM structuring of extracted PDF text into a panel; throws to let callers fall back. */
async function structureLabFromText(filename: string, text: string): Promise<RawLabPanel> {
  const out = await getProvider().complete({
    system:
      "Extract lab markers from this report text into JSON. Return ONLY: {\"panelName\":string,\"collectedAt\":ISO-or-empty,\"markers\":[{\"display\":string,\"value\":number,\"unit\":string,\"refLow\":number|null,\"refHigh\":number|null}]}. Only include markers actually present. Do not invent values.",
    messages: [{ role: "user", content: text.slice(0, 8000) }],
    maxTokens: 1200,
    temperature: 0,
  });
  const json = out.slice(out.indexOf("{"), out.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json);
  return {
    panelName: String(parsed.panelName || filename.replace(/\.[^.]+$/, "")),
    collectedAt: parsed.collectedAt ? new Date(parsed.collectedAt).toISOString() : new Date().toISOString(),
    markers: (parsed.markers ?? []).map((m: Record<string, unknown>) => ({
      code: slugify(String(m.display ?? "marker")),
      display: String(m.display ?? "Marker"),
      value: Number(m.value),
      unit: String(m.unit ?? ""),
      refLow: m.refLow != null ? Number(m.refLow) : undefined,
      refHigh: m.refHigh != null ? Number(m.refHigh) : undefined,
    })),
  };
}

/** Ingest a lab PDF: extract text, structure (LLM or heuristic), then store. */
export async function ingestLabPdf(userId: string, filename: string, buf: Buffer): Promise<Lab[]> {
  const text = await extractPdfText(buf);
  let panel: RawLabPanel;
  if (hasLLM) {
    try {
      panel = await structureLabFromText(filename, text);
      if (!panel.markers.length) panel = heuristicLabFromText(filename, text);
    } catch {
      panel = heuristicLabFromText(filename, text);
    }
  } else {
    panel = heuristicLabFromText(filename, text);
  }
  if (!panel.markers.length) {
    throw new Error(
      "Couldn't read markers from this PDF. Try a JSON/CSV export, or set an LLM key for richer PDF parsing.",
    );
  }
  const created = await storeLabPanels(userId, panel.markers.length ? [panel] : [], "file");
  await logAction(userId, "lab.ingest", { count: created.length, source: "pdf" });
  return created;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function listLabs(userId: string): Promise<Lab[]> {
  return db.select().from(labs).where(eq(labs.userId, userId)).orderBy(desc(labs.collectedAt));
}

export async function getLab(
  id: string,
): Promise<{ lab: Lab; markers: LabMarker[] } | null> {
  const [lab] = await db.select().from(labs).where(eq(labs.id, id));
  if (!lab) return null;
  const markers = await db.select().from(labMarkers).where(eq(labMarkers.labId, id));
  return { lab, markers };
}

/** Re-run the explainer for a panel (used by the "explain" action). */
export async function explainLab(id: string): Promise<string> {
  const data = await getLab(id);
  if (!data) throw new Error("Lab not found");
  const explanation = await aiExplainLab({
    panelName: data.lab.panelName,
    collectedAt: data.lab.collectedAt,
    markers: data.markers
      .filter((m) => m.value != null && Number.isFinite(m.value))
      .map((m) => ({
        code: m.code,
        display: m.display,
        value: m.value as number,
        unit: m.unit ?? "",
        refLow: m.refLow,
        refHigh: m.refHigh,
      })),
  });
  await db.update(labs).set({ explanationMd: explanation }).where(eq(labs.id, id));
  return explanation;
}
