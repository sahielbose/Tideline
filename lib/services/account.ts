/**
 * Account services (CONTEXT.md §10.6, §10.7, §12). Notification opt-in, data
 * export, and data delete are all confirm-gated at the UI and audit-logged.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  users,
  connections,
  observations,
  insights,
  driftSignals,
  reviewFlags,
  labs,
  labMarkers,
  medications,
  chatSessions,
  chatMessages,
  notifications,
  metricBaselines,
  type User,
} from "../db/schema";
import { logAction } from "./audit";

export async function getUser(userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}

export async function updateSettings(
  userId: string,
  patch: Partial<{ name: string; notifyOptIn: boolean; notifyEmail: string; unitsPref: string }>,
): Promise<void> {
  await db.update(users).set(patch).where(eq(users.id, userId));
  await logAction(userId, "account.update_settings", { keys: Object.keys(patch) });
}

/** Confirm-gated full export of the user's data as a JSON object. */
export async function exportData(userId: string): Promise<Record<string, unknown>> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [
    conns,
    obs,
    ins,
    drift,
    reviews,
    labRows,
    meds,
    sessions,
    notifs,
    baselines,
  ] = await Promise.all([
    db.select().from(connections).where(eq(connections.userId, userId)),
    db.select().from(observations).where(eq(observations.userId, userId)),
    db.select().from(insights).where(eq(insights.userId, userId)),
    db.select().from(driftSignals).where(eq(driftSignals.userId, userId)),
    db.select().from(reviewFlags).where(eq(reviewFlags.userId, userId)),
    db.select().from(labs).where(eq(labs.userId, userId)),
    db.select().from(medications).where(eq(medications.userId, userId)),
    db.select().from(chatSessions).where(eq(chatSessions.userId, userId)),
    db.select().from(notifications).where(eq(notifications.userId, userId)),
    db.select().from(metricBaselines).where(eq(metricBaselines.userId, userId)),
  ]);
  const labIds = labRows.map((l) => l.id);
  const markers = labIds.length
    ? await db.select().from(labMarkers)
    : [];
  await logAction(userId, "account.export", {});
  return {
    exportedAt: new Date().toISOString(),
    user: user ? { ...user, passwordHash: undefined } : null,
    connections: conns,
    observations: obs,
    insights: ins,
    driftSignals: drift,
    reviewFlags: reviews,
    labs: labRows,
    labMarkers: markers.filter((m) => labIds.includes(m.labId)),
    medications: meds,
    chatSessions: sessions,
    baselines,
    notifications: notifs,
  };
}

/** Confirm-gated delete of the user and all their data (FK cascade). */
export async function deleteData(userId: string): Promise<void> {
  await logAction(userId, "account.delete", {});
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Confirm-gated "start fresh": wipe the health timeline (observations, labs,
 * connections, drift, insights, baselines, review flags) but keep the account,
 * profile, medications, journal, habits, and chats. Use to clear out demo/mock
 * data before entering your own. Lab markers cascade with their labs.
 */
export async function resetHealthData(userId: string): Promise<void> {
  await db.delete(observations).where(eq(observations.userId, userId));
  await db.delete(labs).where(eq(labs.userId, userId));
  await db.delete(connections).where(eq(connections.userId, userId));
  await db.delete(driftSignals).where(eq(driftSignals.userId, userId));
  await db.delete(insights).where(eq(insights.userId, userId));
  await db.delete(metricBaselines).where(eq(metricBaselines.userId, userId));
  await db.delete(reviewFlags).where(eq(reviewFlags.userId, userId));
  await logAction(userId, "account.reset_health_data", {});
}
