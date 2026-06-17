"use server";

/**
 * Server action for structured symptom intake. Triage-only — submitting opens a
 * flag in the SIMULATED clinician review queue and redirects there. This is not
 * a diagnosis and the reviewer is an AI persona, clearly labeled.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSessionUser } from "@/lib/auth";
import { submitIntake, normalizeIntake } from "@/lib/services/intake";

export async function submitIntakeAction(formData: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const fields = normalizeIntake({
    symptom: String(formData.get("symptom") ?? ""),
    onset: String(formData.get("onset") ?? ""),
    duration: String(formData.get("duration") ?? ""),
    severity: String(formData.get("severity") ?? ""),
    context: String(formData.get("context") ?? ""),
    region: String(formData.get("region") ?? ""),
  });

  // Require at least a symptom; re-render the form otherwise.
  if (!fields.symptom) return;

  await submitIntake(user.id, fields);
  revalidatePath("/app/reviews");
  redirect("/app/reviews");
}
