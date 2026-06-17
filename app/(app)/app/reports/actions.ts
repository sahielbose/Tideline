"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { saveSnapshot } from "@/lib/services/reports";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

/** Capture the current health index + risk + metrics into a saved snapshot. */
export async function saveSnapshotAction(): Promise<void> {
  const userId = await uid();
  await saveSnapshot(userId);
  revalidatePath("/app/reports");
}
