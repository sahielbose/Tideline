/**
 * File-import adapters. Phase 1 ships an offline, no-LLM lab importer that
 * understands two simple formats so "upload a lab" works with zero keys:
 *
 *  1. JSON: { panelName, collectedAt, markers: [{ code, display, value, unit,
 *     refLow, refHigh }] }  (or an array of such panels)
 *  2. CSV with a header row: name,value,unit,refLow,refHigh
 *
 * Phase 2 adds LLM-based PDF parsing (with an OCR fallback for scans) behind
 * this same interface.
 */
import type { RawLabPanel, RawLabMarker } from "../types";

export function parseLabFile(filename: string, content: string): RawLabPanel[] {
  const lower = filename.toLowerCase();
  const trimmed = content.trim();
  if (lower.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseJson(trimmed);
  }
  if (lower.endsWith(".csv") || trimmed.includes(",")) {
    return [parseCsv(filename, trimmed)];
  }
  throw new Error(
    "Unsupported lab file. Provide JSON or CSV. (PDF parsing arrives in Phase 2.)",
  );
}

function parseJson(content: string): RawLabPanel[] {
  const data = JSON.parse(content);
  const panels = Array.isArray(data) ? data : [data];
  return panels.map((p): RawLabPanel => ({
    panelName: String(p.panelName ?? p.name ?? "Imported panel"),
    collectedAt: p.collectedAt ? new Date(p.collectedAt).toISOString() : new Date().toISOString(),
    markers: (p.markers ?? []).map(
      (m: Record<string, unknown>): RawLabMarker => ({
        code: String(m.code ?? slug(String(m.display ?? m.name ?? "marker"))),
        display: String(m.display ?? m.name ?? "Marker"),
        value: Number(m.value),
        unit: String(m.unit ?? ""),
        refLow: m.refLow != null ? Number(m.refLow) : undefined,
        refHigh: m.refHigh != null ? Number(m.refHigh) : undefined,
      }),
    ),
  }));
}

function parseCsv(filename: string, content: string): RawLabPanel {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const markers: RawLabMarker[] = lines.slice(1).map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    const display = cols[idx("name") >= 0 ? idx("name") : 0] ?? "Marker";
    return {
      code: slug(display),
      display,
      value: Number(cols[idx("value") >= 0 ? idx("value") : 1]),
      unit: cols[idx("unit")] ?? "",
      refLow: idx("reflow") >= 0 ? num(cols[idx("reflow")]) : undefined,
      refHigh: idx("refhigh") >= 0 ? num(cols[idx("refhigh")]) : undefined,
    };
  });
  return {
    panelName: filename.replace(/\.[^.]+$/, "") || "Imported panel",
    collectedAt: new Date().toISOString(),
    markers,
  };
}

function num(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
