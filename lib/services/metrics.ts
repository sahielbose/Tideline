/**
 * Timeline metric + baseline services (CONTEXT.md §12). Read the observations
 * spine, expose series for charts, compute personal baselines, and surface the
 * per-metric drift status used by the dashboard cards.
 */
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { observations, metricBaselines, driftSignals } from "../db/schema";
import { METRICS, DASHBOARD_METRICS } from "../metrics";
import { computeBaseline } from "./drift";
import type { MetricSeriesPoint, MetricStatus, Severity } from "../types";

const SEV_TO_STATUS: Record<Severity, MetricStatus> = {
  info: "info",
  watch: "watch",
  elevated: "elevated",
  urgent: "urgent",
};

export async function getMetricSeries(
  userId: string,
  metric: string,
  rangeDays = 120,
): Promise<MetricSeriesPoint[]> {
  const since = new Date(Date.now() - rangeDays * 864e5);
  const rows = await db
    .select({ v: observations.valueNum, t: observations.effectiveAt })
    .from(observations)
    .where(
      and(
        eq(observations.userId, userId),
        eq(observations.code, metric),
        gte(observations.effectiveAt, since),
      ),
    )
    .orderBy(observations.effectiveAt);
  return rows
    .filter((r) => r.v != null)
    .map((r) => ({ t: r.t.toISOString(), v: r.v as number }));
}

export async function getSeriesByCodes(
  userId: string,
  codes: string[],
  rangeDays = 120,
): Promise<Record<string, MetricSeriesPoint[]>> {
  const since = new Date(Date.now() - rangeDays * 864e5);
  const rows = await db
    .select({ code: observations.code, v: observations.valueNum, t: observations.effectiveAt })
    .from(observations)
    .where(
      and(
        eq(observations.userId, userId),
        inArray(observations.code, codes),
        gte(observations.effectiveAt, since),
      ),
    )
    .orderBy(observations.effectiveAt);
  const out: Record<string, MetricSeriesPoint[]> = {};
  for (const code of codes) out[code] = [];
  for (const r of rows) {
    if (r.v == null) continue;
    (out[r.code] ??= []).push({ t: r.t.toISOString(), v: r.v });
  }
  return out;
}

export async function getLatestByMetric(
  userId: string,
): Promise<Record<string, { value: number; unit: string | null; at: string }>> {
  const rows = await db
    .select({
      code: observations.code,
      v: observations.valueNum,
      unit: observations.unit,
      t: observations.effectiveAt,
    })
    .from(observations)
    .where(eq(observations.userId, userId))
    .orderBy(desc(observations.effectiveAt));
  const latest: Record<string, { value: number; unit: string | null; at: string }> = {};
  for (const r of rows) {
    if (r.v == null) continue;
    if (!latest[r.code]) latest[r.code] = { value: r.v, unit: r.unit, at: r.t.toISOString() };
  }
  return latest;
}

/** Latest drift severity per metric (drives the dashboard card status chips). */
export async function getMetricStatuses(userId: string): Promise<Record<string, MetricStatus>> {
  const rows = await db
    .select({ metric: driftSignals.metric, severity: driftSignals.severity })
    .from(driftSignals)
    .where(eq(driftSignals.userId, userId))
    .orderBy(desc(driftSignals.detectedAt));
  const out: Record<string, MetricStatus> = {};
  for (const r of rows) {
    if (!out[r.metric]) out[r.metric] = SEV_TO_STATUS[r.severity];
  }
  return out;
}

export async function getBaselines(
  userId: string,
): Promise<Record<string, { center: number; spread: number; active: boolean }>> {
  const rows = await db
    .select()
    .from(metricBaselines)
    .where(eq(metricBaselines.userId, userId));
  const out: Record<string, { center: number; spread: number; active: boolean }> = {};
  for (const r of rows) out[r.metric] = { center: r.center, spread: r.spread, active: r.active };
  return out;
}

/** Recompute and persist personal baselines for one or all metrics. */
export async function recomputeBaselines(userId: string, metric?: string): Promise<void> {
  const metrics = metric ? [metric] : Object.keys(METRICS);
  const now = new Date();
  const series = await getSeriesByCodes(userId, metrics, 180);
  for (const m of metrics) {
    const def = METRICS[m];
    const pts = series[m] ?? [];
    if (!def || pts.length === 0) continue;
    const base = computeBaseline(pts, def, now);
    if (Number.isNaN(base.center)) continue;
    await db.delete(metricBaselines).where(
      and(eq(metricBaselines.userId, userId), eq(metricBaselines.metric, m)),
    );
    await db.insert(metricBaselines).values({
      userId,
      metric: m,
      center: base.center,
      spread: base.spread,
      windowStart: new Date(base.windowStart),
      windowEnd: new Date(base.windowEnd),
      n: base.n,
      active: base.active,
    });
  }
}

export { DASHBOARD_METRICS };
