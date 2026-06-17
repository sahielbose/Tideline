/**
 * Medication adherence + mocked refill / appointment requests.
 *
 * Tracking and convenience only. Tideline NEVER prescribes, never changes
 * doses, and never books real care. Refill and appointment requests are mocked
 * and land in the simulated clinician/review queue (clearly labeled). The
 * adherence percentage is an illustrative tracking aid — not a clinical or
 * diagnostic measurement.
 */
import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "../db/client";
import { medications, medLogs, reviewFlags, type Medication, type ReviewFlag } from "../db/schema";
import { logAction } from "./audit";

/** Once-daily target over the trailing 7-day window. */
export const ADHERENCE_WINDOW_DAYS = 7;
export const DAILY_TARGET = ADHERENCE_WINDOW_DAYS;

export interface MedAdherence {
  medication: Medication;
  /** Doses logged in the trailing 7 days. */
  doses7d: number;
  /** Assumed once-daily target over the window. */
  target: number;
  /** Illustrative adherence percentage (0–100), capped at 100. */
  percent: number;
  lastTakenAt: string | null;
}

/**
 * Pure computation: given the trailing dose count and target, return an
 * illustrative adherence percentage (0–100, capped). Not a clinical measure.
 */
export function computeAdherencePercent(doses: number, target = DAILY_TARGET): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((doses / target) * 100));
}

/** Trailing 7-day adherence for each ACTIVE medication, ownership-scoped. */
export async function getAdherence(userId: string): Promise<MedAdherence[]> {
  const meds = await db
    .select()
    .from(medications)
    .where(and(eq(medications.userId, userId), eq(medications.active, true)))
    .orderBy(medications.name);

  const since = new Date(Date.now() - ADHERENCE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const logs = await db
    .select()
    .from(medLogs)
    .where(and(eq(medLogs.userId, userId), gte(medLogs.takenAt, since)))
    .orderBy(desc(medLogs.takenAt));

  return meds.map((med) => {
    const forMed = logs.filter((l) => l.medicationId === med.id);
    const doses7d = forMed.length;
    return {
      medication: med,
      doses7d,
      target: DAILY_TARGET,
      percent: computeAdherencePercent(doses7d, DAILY_TARGET),
      lastTakenAt: forMed[0]?.takenAt ? forMed[0].takenAt.toISOString() : null,
    };
  });
}

/** Ownership-scoped: the medication must belong to `userId`. */
async function getOwnedMedication(userId: string, medicationId: string): Promise<Medication> {
  const [med] = await db
    .select()
    .from(medications)
    .where(and(eq(medications.id, medicationId), eq(medications.userId, userId)));
  if (!med) throw new Error("Medication not found");
  return med;
}

/** Record a single dose for an owned medication. */
export async function logDose(userId: string, medicationId: string): Promise<void> {
  await getOwnedMedication(userId, medicationId);
  await db.insert(medLogs).values({ userId, medicationId });
  await logAction(userId, "adherence.log_dose", { medicationId });
}

/**
 * Mocked refill request: opens a flag in the simulated review queue. No
 * pharmacy is contacted and nothing is prescribed.
 */
export async function requestRefill(userId: string, medicationId: string): Promise<ReviewFlag> {
  const med = await getOwnedMedication(userId, medicationId);
  const summary = `Refill request: ${med.name}${med.dose ? ` (${med.dose})` : ""}`;
  const [row] = await db
    .insert(reviewFlags)
    .values({
      userId,
      source: "refill",
      context: {
        summary,
        details:
          "Mocked refill request. Tideline does not prescribe or contact any pharmacy; this is queued to the simulated clinician review only.",
        medicationId,
        medication: med.name,
        dose: med.dose ?? null,
      },
      status: "open",
      simulated: true,
    })
    .returning();
  await logAction(userId, "adherence.request_refill", { medicationId, flagId: row.id });
  return row;
}

/**
 * Mocked appointment request: opens a flag in the simulated review queue. No
 * real appointment is booked and no payment is taken.
 */
export async function requestAppointment(
  userId: string,
  input: { reason: string },
): Promise<ReviewFlag> {
  const reason = input.reason.trim();
  const summary = "Appointment request";
  const [row] = await db
    .insert(reviewFlags)
    .values({
      userId,
      source: "appointment",
      context: {
        summary,
        details:
          reason ||
          "Requested a (mocked) appointment. No real appointment is booked and no payment is taken.",
        reason: reason || null,
      },
      status: "open",
      simulated: true,
    })
    .returning();
  await logAction(userId, "adherence.request_appointment", { flagId: row.id });
  return row;
}
