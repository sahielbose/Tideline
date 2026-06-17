"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { addEntry } from "@/lib/services/journal";

/** Record a symptom/how-you-feel check-in for today. */
export async function addEntryAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const userId = user.id;

  const moodRaw = String(formData.get("mood") ?? "").trim();
  const mood = moodRaw ? Number(moodRaw) : undefined;
  const symptoms = String(formData.get("symptoms") ?? "");
  const note = String(formData.get("note") ?? "");

  // Skip empty submissions entirely.
  if (mood == null && !symptoms.trim() && !note.trim()) return;

  await addEntry(userId, {
    mood: mood != null && Number.isFinite(mood) ? mood : undefined,
    symptoms,
    note,
  });
  revalidatePath("/app/journal");
}
