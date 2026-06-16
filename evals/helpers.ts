import type { MetricSeriesPoint } from "../lib/types";

export const NOW = new Date("2026-06-16T12:00:00.000Z");
const DAY = 86_400_000;

/**
 * Build a deterministic series. `fn(daysAgo)` returns the value for the reading
 * that many days before `now`. Points are returned oldest-first.
 */
export function makeSeries(
  now: Date,
  days: number,
  fn: (daysAgo: number) => number,
  every = 1,
): MetricSeriesPoint[] {
  const pts: MetricSeriesPoint[] = [];
  for (let i = days; i >= 0; i -= every) {
    pts.push({ t: new Date(now.getTime() - i * DAY).toISOString(), v: fn(i) });
  }
  return pts;
}

/** A stable line at `base` with a small deterministic wobble (no trend). */
export function stable(base: number, wobble = 1) {
  return (daysAgo: number) => base + (daysAgo % 2 === 0 ? wobble : -wobble);
}

/** Stable for `daysAgo > driftDays`, then linearly drifts to `to` at daysAgo=0. */
export function drift(base: number, to: number, driftDays: number, wobble = 0) {
  return (daysAgo: number) => {
    const w = wobble ? (daysAgo % 2 === 0 ? wobble : -wobble) : 0;
    if (daysAgo > driftDays) return base + w;
    const progress = (driftDays - daysAgo) / driftDays;
    return base + (to - base) * progress + (daysAgo === 0 ? 0 : w);
  };
}
