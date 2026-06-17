"use server";

/**
 * Server actions for multi-week programs. Each derives the current user from the
 * session and delegates to the ownership-scoped service verbs.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { enroll, toggleStep } from "@/lib/services/programs";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function enrollProgramAction(key: string): Promise<void> {
  const userId = await uid();
  await enroll(userId, key);
  revalidatePath("/app/programs");
}

export async function toggleProgramStepAction(key: string, stepIndex: number): Promise<void> {
  const userId = await uid();
  await toggleStep(userId, key, stepIndex);
  revalidatePath("/app/programs");
}
