/**
 * Trends service (route /app/trends). For the dashboard metrics, compute
 * last-8-weeks weekly averages (grouped by ISO week) from the observation
 * spine, the latest-week-vs-first-week delta, a sparkline, and a short hedged
 * weekly natural-language summary.
 *
 * SAFETY: everything here is descriptive trend math over the user's own
 * readings. Deltas and the summary are illustrative — not a clinical or
 * diagnostic measurement, and not medical advice. Nothing here diagnoses,
 * prescribes, or replaces a licensed provider.
 */
import { METRICS, formatMetricValue } from "../metrics";
import type { MetricSeriesPoint, MetricStatus } from "../types";
import { getSeriesByCodes } from "./metrics";
import { logAction } from "./audit";

/** Metrics surfaced on the Trends page, in display order. */
const TREND_METRICS = [
  "rhr",
  "hrv",
  "bp_systolic",
  "glucose",
  "sleep",
  "spo2",
  "weight",
] as const;

const WEEKS = 8;
const RANGE_DAYS = 90;

export interface WeeklyPoint {
  /** ISO-week key, e.g. "2026-W24". */
  week: string;
  avg: number;
  count: number;
}

export interface MetricTrend {
  key: string;
  display: string;
  unit: string;
  /** Up to the last 8 ISO weeks with at least one reading, oldest first. */
  weeks: WeeklyPoint[];
  /** Sparkline of weekly averages (oldest first). */
  spark: number[];
  /** latest-week avg minus first-week avg; null when fewer than 2 weeks. */
  delta: number | null;
  /** Pre-formatted delta string with sign + unit, or null. */
  deltaLabel: string | null;
  /** Direction of the change for display only. */
  direction: "up" | "down" | "flat" | "none";
  latestValue: number | null;
  status: MetricStatus;
  /** True when there is too little data to draw a meaningful trend. */
  sparse: boolean;
}

export interface TrendsResult {
  metrics: MetricTrend[];
  /** Short, hedged, plain-English weekly summary across all metrics. */
  summary: string;
  /** True when no metric had any usable readings. */
  empty: boolean;
}

/**
 * ISO-8601 week key ("YYYY-Www") for a date. Pure helper so the grouping is
 * testable in isolation.
 */
export function isoWeekKey(d: Date): string {
  // Copy and shift to the nearest Thursday (ISO weeks belong to the year of
  // their Thursday).
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7; // Sunday -> 7
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/**
 * Group a metric series into the last `weeks` ISO weeks of weekly averages,
 * oldest first. Pure: takes points, returns weekly aggregates. Weeks with no
 * readings are simply omitted (we never invent values).
 */
export function weeklyAverages(points: MetricSeriesPoint[], weeks = WEEKS): WeeklyPoint[] {
  const buckets = new Map<string, { sum: number; count: number; ts: number }>();
  for (const p of points) {
    if (p.v == null || !Number.isFinite(p.v)) continue;
    const d = new Date(p.t);
    if (Number.isNaN(d.getTime())) continue;
    const key = isoWeekKey(d);
    const b = buckets.get(key) ?? { sum: 0, count: 0, ts: d.getTime() };
    b.sum += p.v;
    b.count += 1;
    b.ts = Math.max(b.ts, d.getTime());
    buckets.set(key, b);
  }
  const ordered = [...buckets.entries()]
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([week, b]) => ({ week, avg: b.sum / b.count, count: b.count }));
  return ordered.slice(-weeks);
}

/** Round to the metric's configured decimals (default 0). */
function roundFor(key: string, v: number): number {
  const decimals = METRICS[key]?.decimals ?? 0;
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}

function directionFor(delta: number | null, key: string): MetricTrend["direction"] {
  if (delta == null) return "none";
  // Treat a half-unit (or sub-resolution) change as flat to avoid over-reading
  // noise on coarse metrics.
  const epsilon = Math.max(0.0001, 0.5 / 10 ** (METRICS[key]?.decimals ?? 0));
  if (Math.abs(delta) < epsilon) return "flat";
  return delta > 0 ? "up" : "down";
}

/**
 * Build a single metric's trend from its raw series. Pure given the inputs so
 * the per-metric math can be reasoned about and reused.
 */
export function buildMetricTrend(key: string, points: MetricSeriesPoint[]): MetricTrend {
  const def = METRICS[key];
  const display = def?.display ?? key;
  const unit = def?.unit ?? "";
  const weeks = weeklyAverages(points);
  const spark = weeks.map((w) => roundFor(key, w.avg));

  let delta: number | null = null;
  if (weeks.length >= 2) {
    delta = roundFor(key, weeks[weeks.length - 1].avg - weeks[0].avg);
  }

  const sorted = [...points]
    .filter((p) => p.v != null && Number.isFinite(p.v) && !Number.isNaN(new Date(p.t).getTime()))
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
  const latestValue = sorted.length ? sorted[sorted.length - 1].v : null;

  const direction = directionFor(delta, key);
  const deltaLabel =
    delta == null
      ? null
      : `${delta > 0 ? "+" : delta < 0 ? "−" : "±"}${formatMetricValue(key, Math.abs(delta))} ${unit}`.trim();

  return {
    key,
    display,
    unit,
    weeks,
    spark,
    delta,
    deltaLabel,
    direction,
    latestValue,
    status: "normal",
    sparse: weeks.length < 2,
  };
}

/**
 * Compose a short, hedged, non-diagnostic weekly summary from the deltas.
 * Pure: derived only from the already-computed trends. Never asserts cause or
 * clinical meaning.
 */
export function summarizeTrends(metrics: MetricTrend[]): string {
  const moved = metrics.filter((m) => !m.sparse && m.direction !== "none" && m.direction !== "flat");
  if (metrics.every((m) => m.sparse)) {
    return "There isn't enough recent data yet to describe weekly trends. As more readings come in, this will fill out. This is illustrative — not a clinical or diagnostic measurement.";
  }
  if (moved.length === 0) {
    return "Across the last several weeks, your tracked metrics have stayed broadly steady near their recent weekly averages. This is a high-level, illustrative read — not a clinical or diagnostic measurement, and not a substitute for a licensed provider.";
  }
  const parts = moved
    .slice(0, 3)
    .map(
      (m) =>
        `${m.display.toLowerCase()} appears to have trended ${m.direction === "up" ? "upward" : "downward"} by about ${m.deltaLabel?.replace(/^[+−±]/, "")}`,
    );
  const lead =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Over roughly the last 8 weeks, ${lead} (comparing the most recent week's average to the earliest). These are rough, illustrative trends — not a clinical or diagnostic measurement — and weekly averages can shift for many ordinary reasons. For anything that concerns you, talk with a licensed provider.`;
}

/**
 * Trends for the dashboard metrics: weekly averages, deltas, sparklines, and a
 * hedged summary. Scoped to `userId`. Handles sparse/empty data without
 * throwing.
 */
export async function getTrends(userId: string): Promise<TrendsResult> {
  const series = await getSeriesByCodes(userId, [...TREND_METRICS], RANGE_DAYS);
  const metrics = TREND_METRICS.map((key) => buildMetricTrend(key, series[key] ?? []));
  const summary = summarizeTrends(metrics);
  const empty = metrics.every((m) => m.weeks.length === 0);
  await logAction(userId, "trends.view", { metrics: metrics.filter((m) => !m.sparse).length });
  return { metrics, summary, empty };
}
