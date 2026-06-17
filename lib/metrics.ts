import type { ObservationCategory } from "./types";

/**
 * The metric registry. This drives the dashboard cards, the drift engine
 * tuning, the reference-range seed, and the mock biometrics generator.
 *
 * Thresholds are illustrative starting points (CONTEXT.md §8) and are meant to
 * be configurable, not treated as clinical truth.
 */
export interface MetricDef {
  key: string;
  display: string;
  unit: string;
  category: ObservationCategory;
  decimals: number;
  /** Which direction of movement is clinically concerning. */
  concern: "high" | "low" | "both";
  refLow: number | null;
  refHigh: number | null;
  /** Days of history used to compute the personal baseline. */
  baselineWindowDays: number;
  /** Minimum readings before a baseline activates. */
  minReadings: number;
  /** Trend-drift threshold: |slope| per week that counts as drift. */
  trendDeltaPerWeek?: number;
  /** A change from baseline (in units) that is clearly clinically meaningful. */
  clinicalDelta?: number;
  /** Robust z threshold for the personal-anomaly signal. */
  zThreshold?: number;
  /** Show on the main dashboard grid. */
  dashboard: boolean;
  /** Optional custom value formatter (e.g. sleep hours -> H:MM). */
  format?: (v: number) => string;
}

function hoursToHM(v: number): string {
  const h = Math.floor(v);
  const m = Math.round((v - h) * 60);
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export const METRICS: Record<string, MetricDef> = {
  rhr: {
    key: "rhr",
    display: "Resting heart rate",
    unit: "bpm",
    category: "wearable",
    decimals: 0,
    concern: "high",
    refLow: 40,
    refHigh: 100,
    baselineWindowDays: 60,
    minReadings: 7,
    trendDeltaPerWeek: 3,
    clinicalDelta: 10,
    zThreshold: 3,
    dashboard: true,
  },
  hrv: {
    key: "hrv",
    display: "Heart rate variability",
    unit: "ms",
    category: "wearable",
    decimals: 0,
    concern: "low",
    refLow: 20,
    refHigh: 200,
    baselineWindowDays: 60,
    minReadings: 7,
    trendDeltaPerWeek: 4,
    clinicalDelta: 12,
    zThreshold: 3,
    dashboard: true,
  },
  bp_systolic: {
    key: "bp_systolic",
    display: "Systolic blood pressure",
    unit: "mmHg",
    category: "vital",
    decimals: 0,
    concern: "high",
    refLow: 90,
    refHigh: 120,
    baselineWindowDays: 90,
    minReadings: 5,
    trendDeltaPerWeek: 2.5,
    clinicalDelta: 10,
    zThreshold: 3,
    dashboard: false,
  },
  bp_diastolic: {
    key: "bp_diastolic",
    display: "Diastolic blood pressure",
    unit: "mmHg",
    category: "vital",
    decimals: 0,
    concern: "high",
    refLow: 60,
    refHigh: 80,
    baselineWindowDays: 90,
    minReadings: 5,
    trendDeltaPerWeek: 2,
    clinicalDelta: 8,
    zThreshold: 3,
    dashboard: false,
  },
  glucose: {
    key: "glucose",
    display: "Fasting glucose",
    unit: "mg/dL",
    category: "lab",
    decimals: 0,
    concern: "high",
    refLow: 70,
    refHigh: 99,
    baselineWindowDays: 90,
    minReadings: 5,
    trendDeltaPerWeek: 1.5,
    clinicalDelta: 10,
    zThreshold: 3,
    dashboard: true,
  },
  sleep: {
    key: "sleep",
    display: "Sleep",
    unit: "hrs",
    category: "wearable",
    decimals: 1,
    concern: "low",
    refLow: 7,
    refHigh: 9,
    baselineWindowDays: 30,
    minReadings: 7,
    trendDeltaPerWeek: 0.25,
    clinicalDelta: 1,
    zThreshold: 3,
    dashboard: true,
    format: hoursToHM,
  },
  steps: {
    key: "steps",
    display: "Steps",
    unit: "today",
    category: "wearable",
    decimals: 0,
    concern: "low",
    refLow: null,
    refHigh: null,
    baselineWindowDays: 30,
    minReadings: 7,
    zThreshold: 3.5,
    dashboard: true,
    format: (v) => Math.round(v).toLocaleString(),
  },
  spo2: {
    key: "spo2",
    display: "Blood oxygen",
    unit: "%",
    category: "wearable",
    decimals: 0,
    concern: "low",
    refLow: 95,
    refHigh: 100,
    clinicalDelta: 3,
    baselineWindowDays: 30,
    minReadings: 7,
    zThreshold: 3.5,
    dashboard: true,
  },
  weight: {
    key: "weight",
    display: "Weight",
    unit: "lb",
    category: "vital",
    decimals: 0,
    concern: "both",
    refLow: null,
    refHigh: null,
    baselineWindowDays: 90,
    minReadings: 5,
    trendDeltaPerWeek: 1.2,
    clinicalDelta: 5,
    zThreshold: 3.5,
    dashboard: true,
  },
  temperature: {
    key: "temperature",
    display: "Body temperature",
    unit: "°F",
    category: "vital",
    decimals: 1,
    concern: "both",
    refLow: 97,
    refHigh: 99.5,
    clinicalDelta: 1.5,
    baselineWindowDays: 30,
    minReadings: 5,
    zThreshold: 3,
    dashboard: false,
  },
  vo2max: {
    key: "vo2max",
    display: "VO₂max",
    unit: "mL/kg/min",
    category: "wearable",
    decimals: 0,
    concern: "low",
    refLow: 30,
    refHigh: 60,
    clinicalDelta: 3,
    baselineWindowDays: 120,
    minReadings: 4,
    zThreshold: 3,
    dashboard: false,
  },
  body_fat: {
    key: "body_fat",
    display: "Body fat",
    unit: "%",
    category: "wearable",
    decimals: 1,
    concern: "high",
    refLow: 8,
    refHigh: 25,
    clinicalDelta: 2,
    baselineWindowDays: 120,
    minReadings: 4,
    zThreshold: 3,
    dashboard: false,
  },
};

export const DASHBOARD_METRICS = Object.values(METRICS).filter((m) => m.dashboard);

export function metricDef(key: string): MetricDef | undefined {
  return METRICS[key];
}

export function formatMetricValue(key: string, v: number): string {
  const def = METRICS[key];
  if (!def) return String(v);
  if (def.format) return def.format(v);
  return v.toFixed(def.decimals);
}
