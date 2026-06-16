/**
 * Drift + insights orchestration (CONTEXT.md §6 monitoring-sweep flow, §12).
 * runMonitoringSweep loads the metric series, detects drift, drafts AI
 * explanations, persists drift_signals + insights, and — for elevated/urgent
 * signals — auto-opens a review flag and sends a notification.
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { driftSignals, insights, type Insight } from "../db/schema";
import { METRICS } from "../metrics";
import { detectDrift } from "./drift";
import { explainSignal, summarizeMonitoring } from "./ai";
import { getSeriesByCodes, recomputeBaselines } from "./metrics";
import { createReviewFlag } from "./reviews";
import { sendNotification } from "./notifications";
import { logAction } from "./audit";
import { SEVERITY_RANK, type DriftSignal, type InsightStatusType } from "../types";

export interface SweepResult {
  signals: number;
  insightsCreated: number;
  insightsResolved: number;
  reviewFlags: number;
  digest: string;
}

const METRIC_NAME = (m: string) => METRICS[m]?.display ?? m;

export async function detectDriftForUser(userId: string, now = new Date()) {
  const series = await getSeriesByCodes(userId, Object.keys(METRICS), 180);
  return detectDrift(series, now);
}

export async function runMonitoringSweep(
  userId: string,
  opts: { autoEscalate?: boolean } = {},
): Promise<SweepResult> {
  const autoEscalate = opts.autoEscalate ?? true;
  const now = new Date();
  const report = await detectDriftForUser(userId, now);

  await recomputeBaselines(userId);

  // Raw signals are ephemeral; recompute them each sweep.
  await db.delete(driftSignals).where(eq(driftSignals.userId, userId));

  const current = report.signals;
  const currentMetrics = new Set(current.map((s) => s.metric));

  // Existing, not-yet-resolved insights — we upsert against these so user state
  // (acknowledged/flagged) survives, and we can CLOSE THE LOOP on improvement.
  const existing = await db
    .select()
    .from(insights)
    .where(and(eq(insights.userId, userId), ne(insights.status, "resolved")));
  const byMetric = new Map(existing.filter((e) => e.metric).map((e) => [e.metric as string, e]));

  let insightsCreated = 0;
  let insightsResolved = 0;
  let reviewFlagCount = 0;

  // Follow-up loop: a tracked insight whose metric no longer drifts has improved.
  for (const ins of existing) {
    if (ins.metric && !currentMetrics.has(ins.metric)) {
      await db
        .update(insights)
        .set({
          status: "resolved",
          explanationMd: `${ins.explanationMd}\n\n✓ Update: ${METRIC_NAME(ins.metric)} has returned toward your baseline, so this is resolved.`,
        })
        .where(eq(insights.id, ins.id));
      insightsResolved++;
      // Close the loop on any care-plan tasks linked to this insight.
      const { completeTasksForInsight } = await import("./plan");
      await completeTasksForInsight(ins.id);
    }
  }

  for (const sig of current) {
    const [sigRow] = await db
      .insert(driftSignals)
      .values({
        userId,
        metric: sig.metric,
        type: sig.type,
        severity: sig.severity,
        magnitude: sig.magnitude,
        windowStart: new Date(sig.windowStart),
        windowEnd: new Date(sig.windowEnd),
        evidence: sig.evidence,
      })
      .returning();

    const ex = await explainSignal(sig);
    const prev = byMetric.get(sig.metric);

    if (prev) {
      // Refresh the live insight in place; preserve the user's status.
      await db
        .update(insights)
        .set({
          driftSignalId: sigRow.id,
          title: ex.title,
          severity: sig.severity,
          explanationMd: ex.explanationMd,
          recommendedAction: ex.recommendedAction,
        })
        .where(eq(insights.id, prev.id));
      continue;
    }

    const [insRow] = await db
      .insert(insights)
      .values({
        userId,
        driftSignalId: sigRow.id,
        metric: sig.metric,
        title: ex.title,
        severity: sig.severity,
        explanationMd: ex.explanationMd,
        recommendedAction: ex.recommendedAction,
        status: "new",
      })
      .returning();
    insightsCreated++;

    if (autoEscalate && SEVERITY_RANK[sig.severity] >= SEVERITY_RANK.elevated) {
      await createReviewFlag(userId, "insight", {
        insightId: insRow.id,
        title: ex.title,
        severity: sig.severity,
        summary: ex.title,
        details: sig.evidence.summary,
      });
      reviewFlagCount++;
      await sendNotification(userId, {
        subject: `Tideline: ${ex.title}`,
        body: `${sig.evidence.summary}\n\n${ex.recommendedAction}`,
        email: true,
        payload: { insightId: insRow.id, severity: sig.severity },
      });
    }
  }

  const digest = summarizeMonitoring(current);
  await logAction(userId, "monitoring.sweep", {
    signals: current.length,
    insightsCreated,
    insightsResolved,
    reviewFlagCount,
  });

  return {
    signals: current.length,
    insightsCreated,
    insightsResolved,
    reviewFlags: reviewFlagCount,
    digest,
  };
}

// ---- read / mutate insights ----------------------------------------------
const STATUS_RANK: Record<string, number> = { new: 0, flagged: 1, acknowledged: 2, resolved: 3 };

export async function listInsights(
  userId: string,
  opts: { includeResolved?: boolean } = {},
): Promise<Insight[]> {
  const rows = await db
    .select()
    .from(insights)
    .where(eq(insights.userId, userId))
    .orderBy(desc(insights.createdAt));
  const filtered = opts.includeResolved ? rows : rows.filter((r) => r.status !== "resolved");
  // Severity desc, then status (new first), then recency.
  return filtered.sort(
    (a, b) =>
      SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.createdAt.getTime() - a.createdAt.getTime(),
  );
}

/** Ownership-scoped: returns the insight only if it belongs to `userId`. */
export async function getInsight(userId: string, id: string): Promise<Insight | undefined> {
  const [row] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.id, id), eq(insights.userId, userId)));
  return row;
}

export async function getHeroInsight(userId: string): Promise<Insight | null> {
  const list = await listInsights(userId);
  const elevated = list.find((i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.elevated);
  return elevated ?? list[0] ?? null;
}

export async function setInsightStatus(
  userId: string,
  id: string,
  status: InsightStatusType,
): Promise<void> {
  const ins = await getInsight(userId, id);
  if (!ins) throw new Error("Insight not found");
  await db.update(insights).set({ status }).where(eq(insights.id, id));
  await logAction(ins.userId, `insight.${status}`, { insightId: id });
}

export async function acknowledgeInsight(userId: string, id: string): Promise<void> {
  await setInsightStatus(userId, id, "acknowledged");
}

/** Flag an insight for review (confirm-gated at the UI): also opens a flag. */
export async function flagInsight(userId: string, id: string): Promise<void> {
  const ins = await getInsight(userId, id);
  if (!ins) throw new Error("Insight not found");
  await db.update(insights).set({ status: "flagged" }).where(eq(insights.id, id));
  await createReviewFlag(ins.userId, "insight", {
    insightId: ins.id,
    title: ins.title,
    severity: ins.severity,
    summary: ins.title,
    details: ins.explanationMd,
  });
  await logAction(ins.userId, "insight.flagged", { insightId: id });
}
