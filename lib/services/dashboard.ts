/**
 * Dashboard aggregator (CONTEXT.md §4.4, route /app). Composes the metric cards
 * (including the synthetic blood-pressure card), the hero insight, the active
 * insights list, recent activity, and connection status into one payload.
 */
import { METRICS, formatMetricValue } from "../metrics";
import type { MetricStatus } from "../types";
import {
  getLatestByMetric,
  getMetricStatuses,
  getBaselines,
  getSeriesByCodes,
} from "./metrics";
import { listInsights, getHeroInsight } from "./insights";
import { getTimeline } from "./timeline";
import { listConnections } from "./ingestion";
import { getHealthIndex, type HealthIndexResult } from "./health-index";
import type { Insight, Connection } from "../db/schema";
import type { TimelineEntry } from "./timeline";

export interface MetricCard {
  key: string;
  display: string;
  value: string;
  unit: string;
  baseline: string;
  status: MetricStatus;
  series: number[];
  href: string;
}

const ORDER = ["rhr", "hrv", "bp", "glucose", "sleep", "steps", "spo2", "weight"];
const STATUS_RANK: Record<MetricStatus, number> = {
  normal: 0,
  info: 1,
  watch: 2,
  elevated: 3,
  urgent: 4,
};

function worse(a: MetricStatus, b: MetricStatus): MetricStatus {
  return STATUS_RANK[a] >= STATUS_RANK[b] ? a : b;
}

export interface DashboardData {
  cards: MetricCard[];
  heroInsight: Insight | null;
  insights: Insight[];
  activity: TimelineEntry[];
  connections: Connection[];
  healthIndex: HealthIndexResult;
}

export async function getDashboard(userId: string): Promise<DashboardData> {
  const [latest, statuses, baselines, insightList, hero, activity, conns, series, healthIndex] =
    await Promise.all([
      getLatestByMetric(userId),
      getMetricStatuses(userId),
      getBaselines(userId),
      listInsights(userId),
      getHeroInsight(userId),
      getTimeline(userId, { limit: 5 }),
      listConnections(userId),
      getSeriesByCodes(
        userId,
        ["rhr", "hrv", "bp_systolic", "bp_diastolic", "glucose", "sleep", "steps", "spo2", "weight"],
        60,
      ),
      getHealthIndex(userId),
    ]);

  const tail = (code: string, n = 24) => (series[code] ?? []).slice(-n).map((p) => p.v);

  const cards: MetricCard[] = ORDER.map((key): MetricCard | null => {
    if (key === "bp") {
      const sys = latest["bp_systolic"];
      const dia = latest["bp_diastolic"];
      if (!sys || !dia) return null;
      const sBase = baselines["bp_systolic"]?.center;
      const dBase = baselines["bp_diastolic"]?.center;
      const status = worse(statuses["bp_systolic"] ?? "normal", statuses["bp_diastolic"] ?? "normal");
      return {
        key: "bp",
        display: "Blood pressure",
        value: `${Math.round(sys.value)}/${Math.round(dia.value)}`,
        unit: "mmHg",
        baseline:
          sBase != null && dBase != null ? `Baseline ${Math.round(sBase)}/${Math.round(dBase)}` : "Establishing baseline",
        status,
        series: tail("bp_systolic"),
        href: "/app/metrics/bp_systolic",
      };
    }
    const def = METRICS[key];
    const l = latest[key];
    if (!def || !l) return null;
    const base = baselines[key]?.center;
    const prefix = key === "steps" ? "Avg" : "Baseline";
    return {
      key,
      display: def.display,
      value: formatMetricValue(key, l.value),
      unit: def.unit,
      baseline: base != null ? `${prefix} ${formatMetricValue(key, base)}` : "Establishing baseline",
      status: statuses[key] ?? "normal",
      series: tail(key),
      href: `/app/metrics/${key}`,
    };
  }).filter((c): c is MetricCard => c !== null);

  return {
    cards,
    heroInsight: hero,
    insights: insightList,
    activity,
    connections: conns,
    healthIndex,
  };
}
