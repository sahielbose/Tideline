/**
 * Notifications (CONTEXT.md §12). In-app notifications are always recorded;
 * email is only sent when the user has given confirm-gated opt-in AND email is
 * configured. With no RESEND_API_KEY, "email" is logged to the console.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { notifications, users } from "../db/schema";
import { getSettings } from "../settings";
import { logAction } from "./audit";

export interface NotifyInput {
  subject: string;
  body: string;
  /** Attempt email delivery (honored only if the user opted in). */
  email?: boolean;
  payload?: Record<string, unknown>;
}

async function deliverEmail(to: string, subject: string, body: string) {
  const { email } = await getSettings();
  if (!email.enabled) {
    console.log(`[notifications] (email disabled) would send to ${to}: ${subject}`);
    return "logged";
  }
  const { Resend } = await import("resend");
  const resend = new Resend(email.apiKey);
  await resend.emails.send({ from: email.from, to, subject, text: body });
  return "sent";
}

export async function sendNotification(userId: string, input: NotifyInput) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  const [inApp] = await db
    .insert(notifications)
    .values({
      userId,
      channel: "in_app",
      subject: input.subject,
      body: input.body,
      status: "sent",
      payload: input.payload ?? {},
      sentAt: new Date(),
    })
    .returning();

  if (input.email && user?.notifyOptIn) {
    const to = user.notifyEmail || user.email;
    const result = await deliverEmail(to, input.subject, input.body);
    await db.insert(notifications).values({
      userId,
      channel: "email",
      subject: input.subject,
      body: input.body,
      status: result === "sent" ? "sent" : "pending",
      payload: { ...(input.payload ?? {}), to },
      sentAt: new Date(),
    });
    await logAction(userId, "notification.email", { to, subject: input.subject });
  }
  return inApp;
}

export async function listNotifications(userId: string, limit = 30) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
