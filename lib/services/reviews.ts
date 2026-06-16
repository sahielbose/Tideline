/**
 * Review queue — the mocked clinician-in-the-loop (CONTEXT.md §4.8, §12).
 * The reviewer is simulated and clearly labeled; nothing implies a real human
 * reviewed anything. Resolve is confirm-gated at the UI.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { reviewFlags, type ReviewFlag } from "../db/schema";
import { draftReviewerNote as aiDraft } from "./ai";
import { logAction } from "./audit";

export async function createReviewFlag(
  userId: string,
  source: "chat" | "insight",
  context: Record<string, unknown>,
): Promise<ReviewFlag> {
  const [row] = await db
    .insert(reviewFlags)
    .values({ userId, source, context, status: "open", simulated: true })
    .returning();
  await logAction(userId, "review.create", { source, flagId: row.id });
  return row;
}

export async function listReviewFlags(userId: string): Promise<ReviewFlag[]> {
  return db
    .select()
    .from(reviewFlags)
    .where(eq(reviewFlags.userId, userId))
    .orderBy(desc(reviewFlags.createdAt));
}

export async function getReviewFlag(id: string): Promise<ReviewFlag | undefined> {
  const [row] = await db.select().from(reviewFlags).where(eq(reviewFlags.id, id));
  return row;
}

/** Generate (or regenerate) the simulated reviewer note. */
export async function draftReviewerNote(flagId: string): Promise<string> {
  const flag = await getReviewFlag(flagId);
  if (!flag) throw new Error("Review flag not found");
  const ctx = flag.context as Record<string, unknown>;
  const note = await aiDraft({
    source: flag.source as "chat" | "insight",
    summary: String(ctx.summary ?? ctx.title ?? "A monitoring signal was flagged for review."),
    severity: ctx.severity ? String(ctx.severity) : undefined,
    details: ctx.details ? String(ctx.details) : undefined,
  });
  await db
    .update(reviewFlags)
    .set({ reviewerNoteMd: note, status: "in_review" })
    .where(eq(reviewFlags.id, flagId));
  await logAction(flag.userId, "review.draft_note", { flagId });
  return note;
}

/** Confirm-gated resolution. */
export async function resolveReviewFlag(flagId: string, note?: string): Promise<void> {
  const flag = await getReviewFlag(flagId);
  if (!flag) throw new Error("Review flag not found");
  await db
    .update(reviewFlags)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      reviewerNoteMd: note ?? flag.reviewerNoteMd,
    })
    .where(eq(reviewFlags.id, flagId));
  await logAction(flag.userId, "review.resolve", { flagId });
}
