"use server";

/**
 * Server actions for medication adherence + mocked refill / appointment
 * requests. Tideline never prescribes; refill and appointment requests are
 * mocked and land in the simulated review queue.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { logDose, requestRefill, requestAppointment } from "@/lib/services/adherence";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

export async function logDoseAction(medicationId: string) {
  await logDose(await uid(), medicationId);
  revalidatePath("/app/adherence");
}

export async function requestRefillAction(medicationId: string) {
  await requestRefill(await uid(), medicationId);
  revalidatePath("/app/adherence");
  revalidatePath("/app/reviews");
}

export async function requestAppointmentAction(_id: string, formData?: FormData) {
  const userId = await uid();
  const reason = String(formData?.get("reason") ?? "").trim();
  await requestAppointment(userId, { reason });
  revalidatePath("/app/adherence");
  revalidatePath("/app/reviews");
}
