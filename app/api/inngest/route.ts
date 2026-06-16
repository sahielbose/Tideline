/**
 * Inngest endpoint (CONTEXT.md §13). Run the local dev runner with
 * `npm run inngest` to exercise the cron + event jobs. The same logic also runs
 * inline from the service layer, so the app works without the runner.
 */
import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest/client";
import { functions } from "@/lib/inngest/functions";

export const { GET, POST, PUT } = serve({ client: inngest, functions });
