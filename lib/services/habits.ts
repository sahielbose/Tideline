/**
 * Behavior/habit tags + metric-impact correlation (market parity: Oura tags).
 * Correlational only — "associated with", never "caused by". Small samples are
 * suppressed so we never imply signal from a couple of days.
 */
import { and, eq, gte } from "drizzle-orm";
import { db } from "../db/client";
import { habitTags } from "../db/schema";
import { getSeriesByCodes } from "./metrics";
import { METRICS } from "../metrics";
import { logAction } from "./audit";

export const HABIT_TAGS = ["Alcohol", "Late meal", "Late caffeine", "Poor sleep", "Workout", "High stress", "Travel"];
const CORR_METRICS = ["rhr", "hrv", "sleep"];
const MIN_TAGGED_DAYS = 3;

export interface HabitEffect {
  metric: string;
  display: string;
  unit: string;
  taggedAvg: number;
  baseAvg: number;
  deltaPct: number;
}
export interface HabitCorrelation {
  tag: string;
  n: number;
  effects: HabitEffect[];
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const round = (x: number) => Math.round(x * 10) / 10;

/** Pure correlation: same-day metric averages on tagged vs untagged days. */
export function computeHabitCorrelations(
  metrics: string[],
  dayAvg: Record<string, Record<string, number>>,
  tagDays: Record<string, string[]>,
): HabitCorrelation[] {
  const out: HabitCorrelation[] = [];
  for (const [tag, days] of Object.entries(tagDays)) {
    const tagged = new Set(days);
    const effects: HabitEffect[] = [];
    let n = 0;
    for (const m of metrics) {
      const da = dayAvg[m] ?? {};
      const tv: number[] = [];
      const bv: number[] = [];
      for (const [day, val] of Object.entries(da)) (tagged.has(day) ? tv : bv).push(val);
      if (tv.length < MIN_TAGGED_DAYS || bv.length < 1) continue;
      const ta = avg(tv);
      const ba = avg(bv);
      effects.push({
        metric: m,
        display: METRICS[m]?.display ?? m,
        unit: METRICS[m]?.unit ?? "",
        taggedAvg: round(ta),
        baseAvg: round(ba),
        deltaPct: ba ? Math.round(((ta - ba) / ba) * 100) : 0,
      });
      n = Math.max(n, tv.length);
    }
    if (effects.length) out.push({ tag, n, effects });
  }
  return out;
}

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

export async function listTodayTags(userId: string): Promise<string[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({ tag: habitTags.tag })
    .from(habitTags)
    .where(and(eq(habitTags.userId, userId), eq(habitTags.day, today)));
  return rows.map((r) => r.tag);
}

/** Toggle a tag for a given day (default today). */
export async function toggleHabit(userId: string, tag: string, day?: string): Promise<boolean> {
  const d = day ?? new Date().toISOString().slice(0, 10);
  const [existing] = await db
    .select()
    .from(habitTags)
    .where(and(eq(habitTags.userId, userId), eq(habitTags.tag, tag), eq(habitTags.day, d)));
  if (existing) {
    await db.delete(habitTags).where(eq(habitTags.id, existing.id));
    return false;
  }
  await db.insert(habitTags).values({ userId, tag, day: d });
  await logAction(userId, "habit.tag", { tag, day: d });
  return true;
}

export async function getHabitCorrelations(userId: string): Promise<HabitCorrelation[]> {
  const since = new Date(Date.now() - 75 * 864e5).toISOString().slice(0, 10);
  const tagRows = await db
    .select({ tag: habitTags.tag, day: habitTags.day })
    .from(habitTags)
    .where(and(eq(habitTags.userId, userId), gte(habitTags.day, since)));
  if (!tagRows.length) return [];

  const tagDays: Record<string, string[]> = {};
  for (const r of tagRows) (tagDays[r.tag] ??= []).push(r.day);

  const series = await getSeriesByCodes(userId, CORR_METRICS, 75);
  const dayAvg: Record<string, Record<string, number>> = {};
  for (const m of CORR_METRICS) {
    const byDay: Record<string, number[]> = {};
    for (const p of series[m] ?? []) (byDay[dayKey(p.t)] ??= []).push(p.v);
    dayAvg[m] = Object.fromEntries(Object.entries(byDay).map(([d, vs]) => [d, avg(vs)]));
  }
  return computeHabitCorrelations(CORR_METRICS, dayAvg, tagDays);
}
