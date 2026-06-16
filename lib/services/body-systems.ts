/**
 * Body-system / organ rollups (market parity: Function/Superpower). Maps each
 * lab marker + vital to a body system and scores it against optimal/reference
 * ranges. Illustrative, transparent, non-diagnostic.
 */
import { markerStatus, type MarkerStatus } from "../lab-reference";
import type { MetricStatus } from "../types";
import { METRICS } from "../metrics";
import { getBiomarkers } from "./labs";
import { getLatestByMetric } from "./metrics";

export type SystemKey = "cardiovascular" | "metabolic" | "liver" | "kidney" | "inflammation";

const SYSTEM_OF: Record<string, SystemKey> = {
  ldl: "cardiovascular", hdl: "cardiovascular", trig: "cardiovascular", "chol-total": "cardiovascular",
  bp_systolic: "cardiovascular", bp_diastolic: "cardiovascular",
  "glucose-fasting": "metabolic", glucose: "metabolic", hba1c: "metabolic", weight: "metabolic",
  alt: "liver", ast: "liver",
  creatinine: "kidney", egfr: "kidney",
  crp: "inflammation", "hs-crp": "inflammation",
};
const LABEL: Record<SystemKey, string> = {
  cardiovascular: "Cardiovascular", metabolic: "Metabolic", liver: "Liver", kidney: "Kidney", inflammation: "Inflammation",
};
const GOOD: Record<MarkerStatus, number> = { optimal: 100, in: 78, suboptimal: 60, low: 35, high: 30 };
const RANK: Record<MarkerStatus, number> = { optimal: 0, in: 1, suboptimal: 2, low: 3, high: 4 };
const TO_METRIC: Record<MarkerStatus, MetricStatus> = { optimal: "normal", in: "normal", suboptimal: "info", low: "watch", high: "elevated" };

export interface SystemItem {
  display: string;
  system: SystemKey;
  status: MarkerStatus;
}

export interface BodySystem {
  key: SystemKey;
  label: string;
  score: number;
  status: MetricStatus;
  markers: { display: string; status: MarkerStatus }[];
}

export function computeBodySystems(items: SystemItem[]): BodySystem[] {
  const byS = new Map<SystemKey, SystemItem[]>();
  for (const it of items) {
    const a = byS.get(it.system) ?? [];
    a.push(it);
    byS.set(it.system, a);
  }
  const out: BodySystem[] = [];
  for (const [key, arr] of byS) {
    const score = Math.round(arr.reduce((a, c) => a + GOOD[c.status], 0) / arr.length);
    const worst = arr.reduce<MarkerStatus>((w, c) => (RANK[c.status] > RANK[w] ? c.status : w), "optimal");
    out.push({ key, label: LABEL[key], score, status: TO_METRIC[worst], markers: arr.map((a) => ({ display: a.display, status: a.status })) });
  }
  return out.sort((a, b) => a.score - b.score);
}

export async function getBodySystems(userId: string): Promise<BodySystem[]> {
  const items: SystemItem[] = [];
  const markers = await getBiomarkers(userId);
  for (const m of markers) {
    const system = SYSTEM_OF[m.code];
    if (system) items.push({ display: m.display, system, status: m.status });
  }
  // Add vitals (no optimal band; standard reference only).
  const latest = await getLatestByMetric(userId);
  for (const code of ["bp_systolic", "bp_diastolic", "glucose", "weight"]) {
    const l = latest[code];
    const def = METRICS[code];
    const system = SYSTEM_OF[code];
    if (l && def && system) {
      items.push({ display: def.display, system, status: markerStatus(l.value, def.refLow, def.refHigh) });
    }
  }
  return computeBodySystems(items);
}
