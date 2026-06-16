/**
 * Lab services (CONTEXT.md §4.6, §12). Ingest a panel via the labs adapter
 * (mock or file import), persist panel + markers, and attach a plain-English
 * AI explanation.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { labs, labMarkers, connections, type Lab, type LabMarker } from "../db/schema";
import { getLabsAdapter, type LabIngestInput } from "../adapters";
import { explainLab as aiExplainLab, flagFor } from "./ai";
import { logAction } from "./audit";
import type { AdapterKind } from "../types";

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

export async function ingestLab(
  userId: string,
  input: LabIngestInput,
): Promise<Lab[]> {
  const adapter: AdapterKind = input.kind === "file" ? "file" : "mock";
  const panels = await getLabsAdapter(adapter).ingest(input);
  const connId = await ensureLabConnection(userId, adapter);
  const created: Lab[] = [];

  for (const panel of panels) {
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
      panel.markers.map((m) => ({
        labId: lab.id,
        code: m.code,
        display: m.display,
        value: m.value,
        unit: m.unit,
        refLow: m.refLow ?? null,
        refHigh: m.refHigh ?? null,
        flag: flagFor({ ...m, refLow: m.refLow ?? null, refHigh: m.refHigh ?? null }),
      })),
    );

    const explanation = await aiExplainLab({
      panelName: panel.panelName,
      collectedAt: panel.collectedAt,
      markers: panel.markers.map((m) => ({
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

  await logAction(userId, "lab.ingest", { count: created.length, source: input.kind });
  return created;
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
    markers: data.markers.map((m) => ({
      code: m.code,
      display: m.display,
      value: m.value ?? 0,
      unit: m.unit ?? "",
      refLow: m.refLow,
      refHigh: m.refHigh,
    })),
  });
  await db.update(labs).set({ explanationMd: explanation }).where(eq(labs.id, id));
  return explanation;
}
