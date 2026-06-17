/**
 * Multi-week programs — enroll in an illustrative lifestyle protocol and track
 * step-by-step progress. Everything here is general-wellness only: the programs
 * are non-prescriptive, not personalized, and not a substitute for advice from a
 * qualified clinician.
 *
 * Every function is scoped to `userId`; mutations verify ownership of the
 * enrollment row before writing.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { programEnrollments, type ProgramEnrollment } from "../db/schema";
import { PROGRAMS, getProgramDef, type ProgramDef } from "../programs-defs";
import { logAction } from "./audit";

export interface ProgramView {
  def: ProgramDef;
  enrollment: ProgramEnrollment | null;
  enrolled: boolean;
  completed: boolean;
  /** Indices of completed steps, clamped to the current step list. */
  completedSteps: number[];
  /** completed-step count / total steps, as an integer percentage 0–100. */
  progressPct: number;
}

/**
 * Pure progress computation. Kept separate so the math is testable and the
 * completedSteps array is always sanitized (deduped, in-range) before display.
 */
export function computeProgramView(
  def: ProgramDef,
  enrollment: ProgramEnrollment | null,
): ProgramView {
  const total = def.steps.length;
  const raw = enrollment?.completedSteps ?? [];
  const completedSteps = [...new Set(raw)].filter((i) => i >= 0 && i < total).sort((a, b) => a - b);
  const progressPct = total > 0 ? Math.round((completedSteps.length / total) * 100) : 0;
  return {
    def,
    enrollment,
    enrolled: enrollment != null,
    completed: enrollment?.status === "completed",
    completedSteps,
    progressPct,
  };
}

/** All program definitions joined with this user's enrollment status/progress. */
export async function listPrograms(userId: string): Promise<ProgramView[]> {
  const rows = await db
    .select()
    .from(programEnrollments)
    .where(eq(programEnrollments.userId, userId))
    .orderBy(desc(programEnrollments.startedAt));

  // Latest enrollment per program key (rows are newest-first).
  const byKey = new Map<string, ProgramEnrollment>();
  for (const row of rows) {
    if (!byKey.has(row.programKey)) byKey.set(row.programKey, row);
  }

  return PROGRAMS.map((def) => computeProgramView(def, byKey.get(def.key) ?? null));
}

/** Ownership-scoped: latest enrollment for a program key, if any. */
async function getEnrollment(
  userId: string,
  key: string,
): Promise<ProgramEnrollment | undefined> {
  const [row] = await db
    .select()
    .from(programEnrollments)
    .where(and(eq(programEnrollments.userId, userId), eq(programEnrollments.programKey, key)))
    .orderBy(desc(programEnrollments.startedAt));
  return row;
}

/** Enroll in a program (idempotent: returns the existing active enrollment). */
export async function enroll(userId: string, key: string): Promise<ProgramEnrollment> {
  const def = getProgramDef(key);
  if (!def) throw new Error("Unknown program");

  const existing = await getEnrollment(userId, key);
  if (existing && existing.status === "active") return existing;

  const [row] = await db
    .insert(programEnrollments)
    .values({ userId, programKey: key, status: "active", completedSteps: [] })
    .returning();
  await logAction(userId, "program.enroll", { programKey: key });
  return row;
}

/**
 * Toggle a step's completed state. Marks the enrollment `completed` once every
 * step is done, and reopens it to `active` if a step is later unchecked.
 */
export async function toggleStep(
  userId: string,
  key: string,
  stepIndex: number,
): Promise<ProgramEnrollment> {
  const def = getProgramDef(key);
  if (!def) throw new Error("Unknown program");
  if (stepIndex < 0 || stepIndex >= def.steps.length) throw new Error("Invalid step");

  // Ownership check: only act on this user's own enrollment.
  const enrollment = await getEnrollment(userId, key);
  if (!enrollment) throw new Error("Not enrolled in this program");

  const current = new Set(
    (enrollment.completedSteps ?? []).filter((i) => i >= 0 && i < def.steps.length),
  );
  if (current.has(stepIndex)) current.delete(stepIndex);
  else current.add(stepIndex);

  const completedSteps = [...current].sort((a, b) => a - b);
  const allDone = completedSteps.length === def.steps.length;

  const [row] = await db
    .update(programEnrollments)
    .set({
      completedSteps,
      status: allDone ? "completed" : "active",
      completedAt: allDone ? new Date() : null,
    })
    .where(and(eq(programEnrollments.id, enrollment.id), eq(programEnrollments.userId, userId)))
    .returning();
  await logAction(userId, "program.toggle_step", { programKey: key, stepIndex, completed: allDone });
  return row;
}
