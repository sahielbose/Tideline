/**
 * Personalized action plan (market parity: Function/Superpower "protocols / what
 * to do next"). Aggregates active insights into grouped, hedged, plain-English
 * next steps. Non-prescriptive and non-diagnostic by construction.
 */
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "../db/client";
import { carePlanTasks, type CarePlanTask } from "../db/schema";
import { listInsights } from "./insights";
import { logAction } from "./audit";
import { SEVERITY_RANK, type Severity } from "../types";

export interface PlanItem {
  insightId: string;
  title: string;
  action: string;
  metric: string | null;
  severity: Severity;
}

export interface PlanGroup {
  key: string;
  title: string;
  description: string;
  items: PlanItem[];
}

export interface ActionPlan {
  groups: PlanGroup[];
  summary: string;
}

export async function getActionPlan(userId: string): Promise<ActionPlan> {
  const insights = await listInsights(userId); // active (excludes resolved)
  const toItem = (i: (typeof insights)[number]): PlanItem => ({
    insightId: i.id,
    title: i.title,
    action: i.recommendedAction,
    metric: i.metric,
    severity: i.severity,
  });

  const clinician = insights.filter((i) => SEVERITY_RANK[i.severity] >= SEVERITY_RANK.elevated).map(toItem);
  const monitor = insights.filter((i) => i.severity === "watch").map(toItem);
  const watching = insights.filter((i) => i.severity === "info").map(toItem);

  const groups: PlanGroup[] = [
    {
      key: "clinician",
      title: "Bring to a clinician",
      description: "These have crossed into a range worth a professional review if they continue.",
      items: clinician,
    },
    {
      key: "monitor",
      title: "Monitor & adjust",
      description: "Track these and try the usual levers — sleep, hydration, stress, and activity.",
      items: monitor,
    },
    {
      key: "watching",
      title: "Keep an eye on",
      description: "In range, just worth watching alongside the rest.",
      items: watching,
    },
  ].filter((g) => g.items.length > 0);

  const total = insights.length;
  const summary =
    total === 0
      ? "Nothing needs action right now — your tracked metrics are holding near baseline."
      : `You have ${total} active insight${total === 1 ? "" : "s"}. Start with anything in “Bring to a clinician,” then work the lifestyle levers for the rest. This is general guidance, not medical advice.`;

  return { groups, summary };
}

// ---- trackable care-plan tasks (CONTEXT.md §4.5 actions; market parity) ----
export async function listCarePlanTasks(userId: string): Promise<CarePlanTask[]> {
  return db
    .select()
    .from(carePlanTasks)
    .where(eq(carePlanTasks.userId, userId))
    .orderBy(desc(carePlanTasks.createdAt));
}

export async function addCarePlanTask(
  userId: string,
  input: { title: string; detail?: string; metric?: string | null; sourceInsightId?: string | null; dueAt?: Date | null },
): Promise<CarePlanTask> {
  const [row] = await db
    .insert(carePlanTasks)
    .values({
      userId,
      title: input.title,
      detail: input.detail,
      metric: input.metric ?? null,
      sourceInsightId: input.sourceInsightId ?? null,
      dueAt: input.dueAt ?? null,
    })
    .returning();
  await logAction(userId, "careplan.add", { id: row.id });
  return row;
}

/** Ownership-scoped status change (todo -> doing -> done). */
export async function setCarePlanTaskStatus(
  userId: string,
  id: string,
  status: "todo" | "doing" | "done",
): Promise<void> {
  const [task] = await db
    .select()
    .from(carePlanTasks)
    .where(and(eq(carePlanTasks.id, id), eq(carePlanTasks.userId, userId)));
  if (!task) throw new Error("Task not found");
  await db
    .update(carePlanTasks)
    .set({ status, completedAt: status === "done" ? new Date() : null })
    .where(eq(carePlanTasks.id, id));
  await logAction(userId, "careplan.status", { id, status });
}

export async function deleteCarePlanTask(userId: string, id: string): Promise<void> {
  await db.delete(carePlanTasks).where(and(eq(carePlanTasks.id, id), eq(carePlanTasks.userId, userId)));
  await logAction(userId, "careplan.delete", { id });
}

/** Auto-complete tasks linked to an insight that has resolved (follow-up loop). */
export async function completeTasksForInsight(insightId: string): Promise<number> {
  const open = await db
    .select()
    .from(carePlanTasks)
    .where(and(eq(carePlanTasks.sourceInsightId, insightId), ne(carePlanTasks.status, "done")));
  if (!open.length) return 0;
  await db
    .update(carePlanTasks)
    .set({ status: "done", completedAt: new Date() })
    .where(and(eq(carePlanTasks.sourceInsightId, insightId), ne(carePlanTasks.status, "done")));
  return open.length;
}
