/**
 * Background jobs (CONTEXT.md §13). Durable, retried, and offloaded from the
 * request cycle. Each handler is a thin wrapper over the service layer, so the
 * same logic runs whether triggered by Inngest or called inline.
 */
import { inngest } from "./client";
import { db } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import {
  runMonitoringSweep,
  syncConnection,
  recomputeBaselines,
  detectDriftForUser,
  sendNotification,
} from "../services";
import { summarizeMonitoring } from "../services/ai";

// monitoring.sweep — nightly cron across all users
export const monitoringSweepCron = inngest.createFunction(
  { id: "monitoring-sweep-cron" },
  { cron: "0 7 * * *" },
  async ({ step }) => {
    const all = await step.run("load-users", () => db.select({ id: users.id }).from(users));
    for (const u of all) {
      await step.run(`sweep-${u.id}`, () => runMonitoringSweep(u.id));
    }
    return { users: all.length };
  },
);

// monitoring.sweep — on demand (after ingestion, or user-triggered)
export const monitoringSweepRequested = inngest.createFunction(
  { id: "monitoring-sweep-requested" },
  { event: "monitoring/sweep.requested" },
  async ({ event }) => runMonitoringSweep(event.data.userId),
);

// ingestion.run — long-running import/sync, then a sweep
export const ingestionRun = inngest.createFunction(
  { id: "ingestion-run" },
  { event: "ingestion/sync.requested" },
  async ({ event, step }) => {
    const count = await step.run("sync", () => syncConnection(event.data.connectionId));
    return { synced: count };
  },
);

// baselines.recompute
export const baselinesRecompute = inngest.createFunction(
  { id: "baselines-recompute" },
  { event: "baselines/recompute.requested" },
  async ({ event }) => {
    await recomputeBaselines(event.data.userId, event.data.metric);
    return { ok: true };
  },
);

// digest.weekly — opt-in only weekly summary
export const weeklyDigest = inngest.createFunction(
  { id: "digest-weekly" },
  { cron: "0 8 * * 1" },
  async ({ step }) => {
    const optedIn = await step.run("load-opted-in", () =>
      db.select().from(users).where(eq(users.notifyOptIn, true)),
    );
    for (const u of optedIn) {
      await step.run(`digest-${u.id}`, async () => {
        const report = await detectDriftForUser(u.id);
        const digest = summarizeMonitoring(report.signals);
        await sendNotification(u.id, {
          subject: "Your weekly Tideline digest",
          body: digest,
          email: true,
        });
      });
    }
    return { sent: optedIn.length };
  },
);

export const functions = [
  monitoringSweepCron,
  monitoringSweepRequested,
  ingestionRun,
  baselinesRecompute,
  weeklyDigest,
];
