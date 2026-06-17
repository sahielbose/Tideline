"use server";

/**
 * Server actions for the care-team inbox. The reviewer side is SIMULATED
 * (handled inside the service). Ownership is enforced in the service layer.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { postMessage, markThreadRead } from "@/lib/services/messages";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

/** Post a user message and trigger the simulated reviewer auto-reply. */
export async function postMessageAction(reviewFlagId: string, formData?: FormData) {
  const userId = await uid();
  const body = String(formData?.get("body") ?? "").trim();
  if (!body) return;
  await postMessage(userId, reviewFlagId, body);
  revalidatePath("/app/inbox");
  revalidatePath(`/app/inbox/${reviewFlagId}`);
}

/** Mark all (simulated) reviewer messages in a thread as read. */
export async function markThreadReadAction(reviewFlagId: string) {
  const userId = await uid();
  await markThreadRead(userId, reviewFlagId);
  revalidatePath("/app/inbox");
  revalidatePath(`/app/inbox/${reviewFlagId}`);
}
