import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "tideline" });

// Event payload contracts (CONTEXT.md §13).
export type Events = {
  "monitoring/sweep.requested": { data: { userId: string } };
  "ingestion/sync.requested": { data: { connectionId: string } };
  "baselines/recompute.requested": { data: { userId: string; metric?: string } };
};
