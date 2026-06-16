/**
 * Lab PDF ingestion (CONTEXT.md §7 file-import, Phase 2). Extracts text with
 * pdf-parse, then a heuristic parser turns "Marker  value unit  low-high" lines
 * into markers. The labs service optionally refines this with the LLM when a key
 * is present. Text-based PDFs work offline; scanned PDFs need the LLM/OCR path.
 */
import type { RawLabPanel, RawLabMarker } from "../types";

export async function extractPdfText(buf: Buffer): Promise<string> {
  // Import the lib subpath, not the package index, to avoid pdf-parse's
  // debug-mode test-file read under ESM.
  // @ts-expect-error - subpath has no bundled types
  const mod = await import("pdf-parse/lib/pdf-parse.js");
  const pdfParse = (mod.default ?? mod) as (b: Buffer) => Promise<{ text: string }>;
  const data = await pdfParse(buf);
  return data.text ?? "";
}

const LINE = /^([A-Za-z][A-Za-z0-9 ,.'()\/-]{1,48}?)[\s:]+(-?\d+(?:\.\d+)?)\s*([A-Za-z%µ/]+)?(?:\s*\(?\s*(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)\s*\)?)?\s*$/;

/** Best-effort structured parse of extracted lab text. */
export function heuristicLabFromText(filename: string, text: string): RawLabPanel {
  const markers: RawLabMarker[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.length > 80) continue;
    const m = line.match(LINE);
    if (!m) continue;
    const display = m[1].trim().replace(/[:\-]+$/, "").trim();
    const value = Number(m[2]);
    if (Number.isNaN(value) || display.length < 2) continue;
    // Skip lines that are clearly not markers (dates, page numbers, etc.)
    if (/^(page|date|patient|dob|collected|report|phone|fax)\b/i.test(display)) continue;
    markers.push({
      code: slug(display),
      display,
      value,
      unit: m[3] ?? "",
      refLow: m[4] != null ? Number(m[4]) : undefined,
      refHigh: m[5] != null ? Number(m[5]) : undefined,
    });
  }
  return {
    panelName: filename.replace(/\.[^.]+$/, "") || "Imported lab (PDF)",
    collectedAt: new Date().toISOString(),
    markers,
  };
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
