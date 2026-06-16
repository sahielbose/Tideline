import { db } from "../db/client";
import { auditLog } from "../db/schema";

/** Append-only log of confirm-gated actions (CONTEXT.md §11 audit_log). */
export async function logAction(
  userId: string | null,
  action: string,
  detail: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditLog).values({ userId: userId ?? null, action, detail });
}
