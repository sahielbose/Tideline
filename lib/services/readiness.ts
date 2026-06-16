/**
 * Daily readiness / recovery score (market parity: Oura/Whoop). A transparent,
 * deterministic 0-100 blend of how far today's vitals sit from the user's OWN
 * baseline (robust z-scores). Explicitly illustrative, not a medical assessment.
 */
import { clamp } from "./drift/stats";
import { METRICS } from "../metrics";
import { getLatestByMetric, getBaselines } from "./metrics";

const USED = ["rhr", "hrv", "sleep", "spo2", "temperature"];

export interface ReadinessContributor {
  metric: string;
  display: string;
  subscore: number; // 0-100
  deltaPct: number; // % vs baseline
  direction: "up" | "down" | "flat";
}

export interface Readiness {
  score: number;
  label: string;
  contributors: ReadinessContributor[];
  available: number;
  note: string;
}

export interface ReadinessInput {
  metrics: Record<string, { latest: number; center: number; spread: number }>;
}

export function computeReadiness(input: ReadinessInput): Readiness {
  const contributors: ReadinessContributor[] = [];
  for (const m of USED) {
    const d = input.metrics[m];
    const def = METRICS[m];
    if (!d || !def || !Number.isFinite(d.spread) || d.spread <= 0) continue;
    const z = (d.latest - d.center) / d.spread;
    // "worse" is positive: high-concern up, low-concern down, both = any deviation
    const worse =
      def.concern === "high" ? z : def.concern === "low" ? -z : Math.abs(z);
    const subscore = Math.round(clamp(100 - worse * 20, 0, 100));
    const deltaPct = d.center !== 0 ? Math.round(((d.latest - d.center) / Math.abs(d.center)) * 100) : 0;
    contributors.push({
      metric: m,
      display: def.display,
      subscore,
      deltaPct,
      direction: d.latest > d.center ? "up" : d.latest < d.center ? "down" : "flat",
    });
  }
  if (contributors.length < 2) {
    return {
      score: 0,
      label: "Insufficient data",
      contributors,
      available: contributors.length,
      note: "Need a few days of baseline across at least two vitals.",
    };
  }
  const score = Math.round(contributors.reduce((a, c) => a + c.subscore, 0) / contributors.length);
  contributors.sort((a, b) => a.subscore - b.subscore); // worst first
  const label = score >= 80 ? "Primed" : score >= 65 ? "Ready" : score >= 50 ? "Moderate" : "Take it easy";
  return {
    score,
    label,
    contributors,
    available: contributors.length,
    note: "An illustrative daily readiness estimate from how far today's vitals sit from your own baseline — not a medical assessment.",
  };
}

export async function getReadiness(userId: string): Promise<Readiness> {
  const [latest, baselines] = await Promise.all([getLatestByMetric(userId), getBaselines(userId)]);
  const metrics: ReadinessInput["metrics"] = {};
  for (const m of USED) {
    const l = latest[m];
    const b = baselines[m];
    if (l && b && b.active) metrics[m] = { latest: l.value, center: b.center, spread: b.spread };
  }
  return computeReadiness({ metrics });
}
