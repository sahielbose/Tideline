/**
 * File-import parsers (CONTEXT.md §7 "file import"). All deterministic and
 * dependency-light so they work offline with zero keys:
 *
 *  - Labs:      JSON or CSV panels (PDF parsing lives in ./pdf, LLM-assisted).
 *  - Records:   FHIR R4 Bundle JSON  -> conditions, encounters, vitals, labs.
 *  - Wearables: Apple Health export XML, or a simple date,metric,value CSV.
 *
 * Everything normalizes into the shapes the ingestion service stores.
 */
import type { RawLabPanel, RawLabMarker, RawRecord, RawMetricPoint } from "../types";
import { METRICS } from "../metrics";

// ===========================================================================
// LABS
// ===========================================================================
export function parseLabFile(filename: string, content: string): RawLabPanel[] {
  const lower = filename.toLowerCase();
  const trimmed = content.trim();
  if (lower.endsWith(".json") || trimmed.startsWith("{") || trimmed.startsWith("[")) {
    return parseLabJson(trimmed);
  }
  if (lower.endsWith(".csv") || trimmed.includes(",")) {
    return [parseLabCsv(filename, trimmed)];
  }
  throw new Error("Unsupported lab file. Provide JSON or CSV, or a PDF (parsed separately).");
}

function parseLabJson(content: string): RawLabPanel[] {
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

function parseLabCsv(filename: string, content: string): RawLabPanel {
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
  return { panelName: filename.replace(/\.[^.]+$/, "") || "Imported panel", collectedAt: new Date().toISOString(), markers };
}

// ===========================================================================
// RECORDS — FHIR R4 Bundle
// ===========================================================================

/** LOINC / common codes mapped to our internal metric keys. */
const LOINC_TO_METRIC: Record<string, string> = {
  "8867-4": "rhr", // Heart rate
  "40443-4": "rhr", // Resting heart rate
  "80404-7": "hrv", // R-R interval SDNN
  "8480-6": "bp_systolic",
  "8462-4": "bp_diastolic",
  "29463-7": "weight",
  "2339-0": "glucose",
  "1558-6": "glucose", // fasting glucose
  "2708-6": "spo2",
  "59408-5": "spo2",
  "8310-5": "temperature",
};

export function parseFhirBundle(content: string): RawRecord[] {
  const bundle = JSON.parse(content);
  const entries: any[] = Array.isArray(bundle?.entry) ? bundle.entry : [];
  const out: RawRecord[] = [];

  for (const e of entries) {
    const r = e?.resource;
    if (!r?.resourceType) continue;
    switch (r.resourceType) {
      case "Condition": {
        out.push({
          category: "condition",
          code: `condition:${codeOf(r.code) ?? r.id ?? slug(textOf(r.code))}`,
          display: textOf(r.code) || "Condition",
          valueText: r.clinicalStatus?.coding?.[0]?.code ?? "active",
          effectiveAt: r.onsetDateTime ?? r.recordedDate ?? new Date().toISOString(),
          raw: r,
        });
        break;
      }
      case "Encounter": {
        out.push({
          category: "encounter",
          code: `encounter:${r.id ?? slug(textOf(r.type?.[0]))}`,
          display: textOf(r.type?.[0]) || r.class?.display || "Encounter",
          valueText: r.serviceProvider?.display ?? r.class?.code ?? "",
          effectiveAt: r.period?.start ?? new Date().toISOString(),
          raw: r,
        });
        break;
      }
      case "Observation": {
        const isVital = (r.category ?? []).some((c: any) =>
          (c.coding ?? []).some((cc: any) => cc.code === "vital-signs"),
        );
        const loinc = codeOf(r.code);
        const metric = loinc ? LOINC_TO_METRIC[loinc] : undefined;
        const q = r.valueQuantity;
        if (q?.value == null) break;
        out.push({
          category: metric ? METRICS[metric].category : isVital ? "vital" : "lab",
          code: metric ?? `obs:${loinc ?? slug(textOf(r.code))}`,
          display: metric ? METRICS[metric].display : textOf(r.code) || "Observation",
          value: Number(q.value),
          unit: q.unit ?? (metric ? METRICS[metric].unit : ""),
          effectiveAt: r.effectiveDateTime ?? r.issued ?? new Date().toISOString(),
          raw: r,
        });
        break;
      }
      case "MedicationStatement":
      case "MedicationRequest": {
        const name = r.medicationCodeableConcept?.text || textOf(r.medicationCodeableConcept) || "Medication";
        out.push({
          category: "medication_event",
          code: `medication:${slug(name)}`,
          display: name,
          valueText: r.status ?? "active",
          effectiveAt: r.effectiveDateTime ?? r.authoredOn ?? new Date().toISOString(),
          raw: r,
        });
        break;
      }
      default:
        break;
    }
  }
  return out;
}

function textOf(cc: any): string {
  return cc?.text || cc?.coding?.[0]?.display || "";
}
function codeOf(cc: any): string | undefined {
  return cc?.coding?.[0]?.code;
}

// ===========================================================================
// WEARABLES — Apple Health export XML, or date,metric,value CSV
// ===========================================================================

const HK_TO_METRIC: Record<string, string> = {
  HKQuantityTypeIdentifierRestingHeartRate: "rhr",
  HKQuantityTypeIdentifierHeartRate: "rhr",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv",
  HKQuantityTypeIdentifierBloodPressureSystolic: "bp_systolic",
  HKQuantityTypeIdentifierBloodPressureDiastolic: "bp_diastolic",
  HKQuantityTypeIdentifierOxygenSaturation: "spo2",
  HKQuantityTypeIdentifierBodyMass: "weight",
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierBodyTemperature: "temperature",
};

export function parseWearableFile(filename: string, content: string): RawMetricPoint[] {
  const trimmed = content.trim();
  if (trimmed.startsWith("<") || trimmed.includes("<Record")) return parseAppleHealth(trimmed);
  return parseWearableCsv(trimmed);
}

function parseAppleHealth(xml: string): RawMetricPoint[] {
  const out: RawMetricPoint[] = [];
  const re = /<Record\b([^>]*?)\/?>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const type = attr(attrs, "type");
    const metric = type ? HK_TO_METRIC[type] : undefined;
    if (!metric) continue;
    const value = Number(attr(attrs, "value"));
    if (Number.isNaN(value)) continue;
    const date = attr(attrs, "startDate") || attr(attrs, "creationDate");
    const def = METRICS[metric];
    out.push({
      code: metric,
      display: def.display,
      value,
      unit: attr(attrs, "unit") || def.unit,
      effectiveAt: date ? new Date(date.replace(/ ([+-]\d{4})$/, "$1")).toISOString() : new Date().toISOString(),
      category: def.category,
    });
  }
  return out;
}

function parseWearableCsv(content: string): RawMetricPoint[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const di = header.indexOf("date");
  const mi = header.indexOf("metric");
  const vi = header.indexOf("value");
  if (di < 0 || mi < 0 || vi < 0) {
    throw new Error("Wearable CSV needs a header: date,metric,value (metric = rhr, hrv, sleep, …).");
  }
  const out: RawMetricPoint[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const metric = cols[mi];
    const def = METRICS[metric];
    if (!def) continue;
    const value = Number(cols[vi]);
    if (Number.isNaN(value)) continue;
    out.push({
      code: metric,
      display: def.display,
      value,
      unit: def.unit,
      effectiveAt: new Date(cols[di]).toISOString(),
      category: def.category,
    });
  }
  return out;
}

function attr(attrs: string, name: string): string {
  const m = attrs.match(new RegExp(`${name}="([^"]*)"`));
  return m ? m[1] : "";
}

// ===========================================================================
// shared helpers
// ===========================================================================
function num(v: string | undefined): number | undefined {
  if (v == null || v === "") return undefined;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}
function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
