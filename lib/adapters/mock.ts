/**
 * Mock adapters — deterministic, internally consistent synthetic data that
 * makes Tideline fully demoable with zero external accounts (CONTEXT.md §7).
 *
 * The biometric generator encodes the demo's "we caught the drift" story:
 * resting heart rate rising 58 -> 71 over ~2 weeks while HRV and sleep fall,
 * blood pressure drifting up across the reference line, fasting glucose creeping
 * toward the top of its range, and everything else stable.
 */
import type {
  RawMetricPoint,
  RawRecord,
  RawLabPanel,
  RawLabMarker,
} from "../types";
import { METRICS } from "../metrics";

// ---- seeded PRNG (mulberry32) so the demo is reproducible ----------------
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

interface MetricSpec {
  days: number;
  every: number; // cadence in days
  base: number;
  noise: number;
  drift?: { days: number; to: number };
  anchorLast?: number; // force the most recent reading exactly
}

const SPECS: Record<string, MetricSpec> = {
  rhr: { days: 75, every: 1, base: 58, noise: 1.3, drift: { days: 14, to: 71 }, anchorLast: 71 },
  hrv: { days: 75, every: 1, base: 58, noise: 2, drift: { days: 20, to: 44 }, anchorLast: 44 },
  bp_systolic: { days: 80, every: 2, base: 118, noise: 1.8, drift: { days: 24, to: 128 }, anchorLast: 128 },
  bp_diastolic: { days: 80, every: 2, base: 76, noise: 1.4, drift: { days: 24, to: 82 }, anchorLast: 82 },
  sleep: { days: 60, every: 1, base: 7.4, noise: 0.22, drift: { days: 20, to: 6.4 }, anchorLast: 6.4 },
  steps: { days: 60, every: 1, base: 7900, noise: 600, anchorLast: 8432 },
  spo2: { days: 60, every: 1, base: 97, noise: 0.5 },
  weight: { days: 90, every: 2, base: 176, noise: 0.5, drift: { days: 90, to: 178 }, anchorLast: 178 },
  glucose: { days: 90, every: 3, base: 90, noise: 1.2, drift: { days: 45, to: 96 }, anchorLast: 96 },
  temperature: { days: 45, every: 2, base: 98.2, noise: 0.3 },
  vo2max: { days: 120, every: 7, base: 44, noise: 0.5, anchorLast: 45 },
  body_fat: { days: 120, every: 7, base: 22, noise: 0.3, anchorLast: 21.5 },
};

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function buildSeries(metric: string, now: Date, rng: () => number): RawMetricPoint[] {
  const spec = SPECS[metric];
  const def = METRICS[metric];
  if (!spec || !def) return [];
  const points: RawMetricPoint[] = [];
  for (let i = spec.days; i >= 0; i -= spec.every) {
    let v = spec.base;
    if (spec.drift && i <= spec.drift.days) {
      const progress = (spec.drift.days - i) / spec.drift.days;
      v = spec.base + (spec.drift.to - spec.base) * progress;
    }
    v += (rng() - 0.5) * 2 * spec.noise;
    if (i === 0 && spec.anchorLast !== undefined) v = spec.anchorLast;
    points.push({
      code: metric,
      display: def.display,
      value: round(v, def.decimals),
      unit: def.unit,
      effectiveAt: new Date(now.getTime() - i * DAY).toISOString(),
      category: def.category,
    });
  }
  return points;
}

/** All biometric series keyed by metric. Used by the mock adapter and the seed. */
export function buildBiometricSeries(
  now: Date = new Date(),
  seed = 1733749, // fixed seed -> reproducible demo data
): Record<string, RawMetricPoint[]> {
  const rng = mulberry32(seed);
  const out: Record<string, RawMetricPoint[]> = {};
  for (const metric of Object.keys(SPECS)) {
    out[metric] = buildSeries(metric, now, rng);
  }
  return out;
}

export function buildBiometricPoints(now: Date = new Date()): RawMetricPoint[] {
  return Object.values(buildBiometricSeries(now)).flat();
}

// ---- records (conditions + encounters) -----------------------------------
export function generateRecords(now: Date = new Date()): RawRecord[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  return [
    {
      category: "condition",
      code: "condition:allergic-rhinitis",
      display: "Seasonal allergic rhinitis",
      valueText: "Active",
      effectiveAt: ago(680),
      raw: { clinicalStatus: "active" },
    },
    {
      category: "condition",
      code: "condition:vitamin-d-insufficiency",
      display: "Vitamin D insufficiency",
      valueText: "Resolved",
      effectiveAt: ago(520),
      raw: { clinicalStatus: "resolved" },
    },
    {
      category: "encounter",
      code: "encounter:annual-physical",
      display: "Annual physical exam",
      valueText: "Acme Health — Dr. Patel",
      effectiveAt: ago(240),
      raw: { type: "wellness" },
    },
    {
      category: "encounter",
      code: "encounter:urgent-care-uri",
      display: "Telehealth visit — upper respiratory infection",
      valueText: "Optum Virtual Care",
      effectiveAt: ago(410),
      raw: { type: "acute" },
    },
  ];
}

// ---- labs ----------------------------------------------------------------
function flagOf(value: number, refLow?: number, refHigh?: number): "in" | "low" | "high" {
  if (refHigh != null && value > refHigh) return "high";
  if (refLow != null && value < refLow) return "low";
  return "in";
}

function marker(
  code: string,
  display: string,
  value: number,
  unit: string,
  refLow?: number,
  refHigh?: number,
): RawLabMarker {
  return { code, display, value, unit, refLow, refHigh };
}

export function generateLabPanels(now: Date = new Date()): RawLabPanel[] {
  const ago = (days: number) => new Date(now.getTime() - days * DAY).toISOString();
  // Three draws over ~9 months so every marker has a trend (oldest -> newest).
  const draws = [270, 120, 1];
  const lipid = (i: number): RawLabPanel => ({
    panelName: "Lipid panel",
    collectedAt: ago(draws[i]),
    markers: [
      marker("chol-total", "Total cholesterol", [190, 198, 205][i], "mg/dL", 125, 200),
      marker("ldl", "LDL cholesterol", [118, 126, 132][i], "mg/dL", 0, 100),
      marker("hdl", "HDL cholesterol", [60, 59, 58][i], "mg/dL", 40, 120),
      marker("trig", "Triglycerides", [110, 115, 120][i], "mg/dL", 0, 150),
    ],
  });
  const metabolic = (i: number): RawLabPanel => ({
    panelName: "Metabolic panel",
    collectedAt: ago(draws[i]),
    markers: [
      marker("glucose-fasting", "Fasting glucose", [90, 93, 96][i], "mg/dL", 70, 99),
      marker("hba1c", "Hemoglobin A1c", [5.3, 5.5, 5.6][i], "%", 4.0, 5.6),
      marker("creatinine", "Creatinine", [0.9, 0.9, 0.9][i], "mg/dL", 0.6, 1.3),
      marker("egfr", "eGFR", [98, 96, 95][i], "mL/min", 60, 200),
      marker("alt", "ALT", [22, 23, 24][i], "U/L", 7, 56),
    ],
  });
  const panels: RawLabPanel[] = [];
  for (let i = 0; i < draws.length; i++) {
    panels.push(lipid(i), metabolic(i));
  }
  return panels;
}

export const MOCK_MEDICATIONS = [
  {
    name: "Cetirizine",
    dose: "10 mg",
    schedule: "Once daily",
    startedDaysAgo: 300,
    notes: "For seasonal allergies. Over-the-counter.",
  },
  {
    name: "Vitamin D3",
    dose: "2000 IU",
    schedule: "Once daily",
    startedDaysAgo: 500,
    notes: "Supplement.",
  },
];
