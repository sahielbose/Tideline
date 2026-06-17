"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { updateProfile, type HealthProfile } from "@/lib/services/profile";

/** Split a comma-separated textarea/input value into a trimmed string[]. */
function parseList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Save the structured health profile from the form. Informational only. */
export async function updateProfileAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const heightRaw = String(formData.get("heightCm") ?? "").trim();
  const heightNum = Number(heightRaw);

  const patch: Partial<HealthProfile> = {
    conditions: parseList(formData.get("conditions")),
    allergies: parseList(formData.get("allergies")),
    familyHistory: parseList(formData.get("familyHistory")),
    goals: parseList(formData.get("goals")),
    heightCm: heightRaw && Number.isFinite(heightNum) && heightNum > 0 ? heightNum : undefined,
  };

  await updateProfile(user.id, patch);
  revalidatePath("/app/profile");
}
