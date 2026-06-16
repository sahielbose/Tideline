/**
 * Optimal / longevity ranges for common lab markers — tighter than the standard
 * reference range (the "Optimal vs Normal" distinction popular in longevity
 * health products). Illustrative starting points, configurable, NOT clinical
 * truth. A marker can be in the standard range but not yet optimal.
 */
export interface OptimalRange {
  low?: number;
  high?: number;
}

const OPTIMAL: Record<string, OptimalRange> = {
  "ldl": { high: 80 },
  "ldl-cholesterol": { high: 80 },
  "hdl": { low: 60 },
  "hdl-cholesterol": { low: 60 },
  "trig": { high: 100 },
  "triglycerides": { high: 100 },
  "chol-total": { high: 180 },
  "total-cholesterol": { high: 180 },
  "glucose-fasting": { low: 70, high: 90 },
  "fasting-glucose": { low: 70, high: 90 },
  "glucose": { low: 70, high: 90 },
  "hba1c": { low: 4.0, high: 5.4 },
  "hemoglobin-a1c": { low: 4.0, high: 5.4 },
  "creatinine": { low: 0.7, high: 1.1 },
  "egfr": { low: 90 },
  "alt": { high: 30 },
  "ast": { high: 30 },
  "crp": { high: 1 },
  "hs-crp": { high: 1 },
  "vitamin-d": { low: 40, high: 60 },
  "tsh": { low: 1, high: 2.5 },
};

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function optimalFor(code: string, display: string): OptimalRange | undefined {
  return OPTIMAL[code] ?? OPTIMAL[slug(display)] ?? OPTIMAL[slug(code)];
}

export type MarkerStatus = "low" | "high" | "optimal" | "suboptimal" | "in";

/** Status combining the standard range and (if any) the optimal band. */
export function markerStatus(
  value: number,
  refLow?: number | null,
  refHigh?: number | null,
  optLow?: number | null,
  optHigh?: number | null,
): MarkerStatus {
  if (refHigh != null && value > refHigh) return "high";
  if (refLow != null && value < refLow) return "low";
  if (optLow != null || optHigh != null) {
    const inOptimal = (optLow == null || value >= optLow) && (optHigh == null || value <= optHigh);
    return inOptimal ? "optimal" : "suboptimal";
  }
  return "in";
}

export const MARKER_STATUS_CHIP: Record<MarkerStatus, { cls: string; label: string }> = {
  low: { cls: "watch", label: "Low" },
  high: { cls: "elev", label: "High" },
  optimal: { cls: "ok", label: "Optimal" },
  suboptimal: { cls: "info", label: "In range" },
  in: { cls: "ok", label: "In range" },
};
