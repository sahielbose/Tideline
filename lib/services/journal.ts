/**
 * Symptom journal / check-ins (how-you-feel log). Self-tracking only — these
 * entries are NOT a diagnosis and nothing here is interpreted as a clinical
 * assessment. Every query is ownership-scoped by userId.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { journalEntries, type JournalEntry } from "../db/schema";
import { logAction } from "./audit";

export interface JournalInput {
  mood?: number;
  symptoms?: string;
  note?: string;
}

/** Today's local date as a 'YYYY-MM-DD' string (date column format). */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Clamp a mood to the supported 1–5 scale, or null when absent/invalid.
 * Pure so it can be unit-tested without a DB.
 */
export function normalizeMood(mood: number | undefined): number | null {
  if (mood == null || !Number.isFinite(mood)) return null;
  return Math.min(5, Math.max(1, Math.round(mood)));
}

/** Record a check-in for today. Empty strings are stored as null. */
export async function addEntry(userId: string, input: JournalInput): Promise<JournalEntry> {
  const symptoms = input.symptoms?.trim() || null;
  const note = input.note?.trim() || null;
  const [row] = await db
    .insert(journalEntries)
    .values({
      userId,
      day: today(),
      mood: normalizeMood(input.mood),
      symptoms,
      note,
    })
    .returning();
  await logAction(userId, "journal.add_entry", { entryId: row.id, day: row.day });
  return row;
}

/** Reverse-chronological list of a user's check-ins. */
export async function listEntries(userId: string, limit = 60): Promise<JournalEntry[]> {
  return db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(limit);
}
