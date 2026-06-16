/**
 * Unified clinical timeline (CONTEXT.md §4.3). Merges normalized observations
 * (conditions, encounters, notable vitals), labs, insights, and connection
 * syncs into one reverse-chronological feed, filterable by category.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { observations, labs, insights, connections } from "../db/schema";
import { timeAgo } from "../utils";

export type TimelineCategory =
  | "insight"
  | "lab"
  | "vital"
  | "condition"
  | "encounter"
  | "sync"
  | "medication";

export interface TimelineEntry {
  id: string;
  category: TimelineCategory;
  title: string;
  meta: string;
  at: string; // ISO
  href?: string;
}

export async function getTimeline(
  userId: string,
  opts: { category?: TimelineCategory; limit?: number } = {},
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // conditions + encounters (and a few notable recent vitals)
  const obsRows = await db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.userId, userId),
        inArray(observations.category, ["condition", "encounter"]),
      ),
    )
    .orderBy(desc(observations.effectiveAt));
  for (const o of obsRows) {
    entries.push({
      id: o.id,
      category: o.category === "encounter" ? "encounter" : "condition",
      title: o.display,
      meta: o.valueText ?? "",
      at: o.effectiveAt.toISOString(),
    });
  }

  // latest blood pressure reading as a representative vital
  const [latestBpS] = await db
    .select()
    .from(observations)
    .where(and(eq(observations.userId, userId), eq(observations.code, "bp_systolic")))
    .orderBy(desc(observations.effectiveAt))
    .limit(1);
  if (latestBpS) {
    const [latestBpD] = await db
      .select()
      .from(observations)
      .where(and(eq(observations.userId, userId), eq(observations.code, "bp_diastolic")))
      .orderBy(desc(observations.effectiveAt))
      .limit(1);
    entries.push({
      id: latestBpS.id,
      category: "vital",
      title: `Blood pressure logged ${Math.round(latestBpS.valueNum ?? 0)}/${Math.round(latestBpD?.valueNum ?? 0)}`,
      meta: "From your connected wearable",
      at: latestBpS.effectiveAt.toISOString(),
    });
  }

  // labs
  const labRows = await db.select().from(labs).where(eq(labs.userId, userId));
  for (const l of labRows) {
    entries.push({
      id: l.id,
      category: "lab",
      title: `Lab added: ${l.panelName.toLowerCase()}`,
      meta: "Tap to see the explained panel",
      at: l.collectedAt.toISOString(),
      href: `/app/labs/${l.id}`,
    });
  }

  // insights
  const insightRows = await db.select().from(insights).where(eq(insights.userId, userId));
  for (const i of insightRows) {
    entries.push({
      id: i.id,
      category: "insight",
      title: i.title,
      meta: `Insight · ${i.severity}`,
      at: i.createdAt.toISOString(),
      href: `/app/insights/${i.id}`,
    });
  }

  // connection syncs
  const connRows = await db.select().from(connections).where(eq(connections.userId, userId));
  for (const c of connRows) {
    if (!c.lastSyncedAt) continue;
    entries.push({
      id: c.id,
      category: "sync",
      title: `${c.label} synced`,
      meta: timeAgo(c.lastSyncedAt),
      at: c.lastSyncedAt.toISOString(),
    });
  }

  const filtered = opts.category ? entries.filter((e) => e.category === opts.category) : entries;
  filtered.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  return opts.limit ? filtered.slice(0, opts.limit) : filtered;
}
