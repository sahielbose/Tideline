/**
 * Composite "health index" + illustrative health-age (CONTEXT.md positioning:
 * the longevity/metabolic persona). This is a TRANSPARENT, deterministic blend
 * of the user's tracked metrics — explicitly labeled illustrative, NOT a
 * validated clinical or biological-age measurement (no-fabrication rule).
 */
import { clamp } from "./drift/stats";
import { METRICS } from "../metrics";
import { getLatestByMetric } from "./metrics";
import { getUser } from "./account";

export interface HealthIndexInput {
  metrics: Partial<Record<string, number>>;
  ageYears?: number | null;
}

export interface HealthIndexResult {
  index: number; // 0-100, higher is better
  label: string;
  healthAge: number | null;
  ageYears: number | null;
  components: { metric: string; display: string; score: number }[];
  available: number;
  note: string;
}

/** Per-metric favorability score (0-100, higher = better). */
const SCORERS: Record<string, (v: number) => number> = {
  rhr: (v) => 100 - (v - 55) * 2.5,
  hrv: (v) => (v - 25) * 1.6,
  bp_systolic: (v) => 100 - (v - 110) * 2,
  bp_diastolic: (v) => 100 - (v - 70) * 2.5,
  glucose: (v) => 100 - (v - 85) * 2.5,
  sleep: (v) => 100 - Math.abs(v - 8) * 22,
  spo2: (v) => 100 - (98 - v) * 12,
};

const LABEL = (i: number) =>
  i >= 80 ? "Excellent" : i >= 65 ? "Good" : i >= 50 ? "Fair" : "Needs attention";

export function computeHealthIndex(input: HealthIndexInput): HealthIndexResult {
  const components: { metric: string; display: string; score: number }[] = [];
  for (const [metric, scorer] of Object.entries(SCORERS)) {
    const v = input.metrics[metric];
    if (v == null || Number.isNaN(v)) continue;
    components.push({
      metric,
      display: METRICS[metric]?.display ?? metric,
      score: Math.round(clamp(scorer(v), 0, 100)),
    });
  }
  const index = components.length
    ? Math.round(components.reduce((a, c) => a + c.score, 0) / components.length)
    : 0;
  const ageYears = input.ageYears ?? null;
  const healthAge =
    ageYears != null ? Math.max(18, Math.round(ageYears + (60 - index) / 4)) : null;
  return {
    index,
    label: LABEL(index),
    healthAge,
    ageYears,
    components: components.sort((a, b) => a.score - b.score),
    available: components.length,
    note: "An illustrative blend of your tracked metrics — not a validated clinical or biological-age measurement.",
  };
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

export async function getHealthIndex(userId: string): Promise<HealthIndexResult> {
  const [latest, user] = await Promise.all([getLatestByMetric(userId), getUser(userId)]);
  const metrics: Partial<Record<string, number>> = {};
  for (const key of Object.keys(SCORERS)) {
    if (latest[key]) metrics[key] = latest[key].value;
  }
  return computeHealthIndex({ metrics, ageYears: ageFromDob(user?.dob) });
}
