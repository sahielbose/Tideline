"use server";

/**
 * Server actions — the mutation surface for the UI (CONTEXT.md §5). Each wraps a
 * service verb; real-world-consequence actions are confirm-gated in the UI
 * before they call these.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser, authenticate, registerUser, destroySession } from "@/lib/auth";
import {
  acknowledgeInsight,
  flagInsight,
  runMonitoringSweep,
  syncConnection,
  connectSource,
  listConnections,
  ingestLab,
  ingestLabPdf,
  importFile,
  addMedication,
  updateSettings,
  exportData,
  deleteData,
  resolveReviewFlag,
  draftReviewerNote,
  createReviewFlag,
} from "@/lib/services";
import type { AdapterKind, ConnectionKind } from "@/lib/types";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

// ---- auth -----------------------------------------------------------------
export type AuthState = { error?: string };

export async function loginAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const user = await authenticate(email, password);
  if (!user) return { error: "Invalid email or password." };
  redirect("/app");
}

export async function signupAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!email || password.length < 6) {
    return { error: "Enter an email and a password of at least 6 characters." };
  }
  try {
    await registerUser(email, password, name);
  } catch {
    return { error: "That email is already registered." };
  }
  redirect("/onboarding");
}

export async function demoLoginAction() {
  await authenticate("demo@tideline.app", "tideline");
  redirect("/app");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** Populate the current account with the full mock dataset (onboarding). */
export async function seedDemoForCurrentUserAction() {
  const userId = await uid();
  await connectSource(userId, "records", "mock");
  await connectSource(userId, "wearable", "mock");
  await ingestLab(userId, { kind: "mock" });
  await runMonitoringSweep(userId);
  revalidatePath("/app");
  redirect("/app");
}

// ---- insights -------------------------------------------------------------
export async function ackInsightAction(id: string) {
  await acknowledgeInsight(id);
  revalidatePath("/app");
  revalidatePath("/app/insights");
}

export async function flagInsightAction(id: string) {
  await flagInsight(id);
  revalidatePath("/app");
  revalidatePath("/app/insights");
  revalidatePath("/app/reviews");
}

// ---- data / connections ---------------------------------------------------
export async function syncDataAction() {
  const userId = await uid();
  const conns = await listConnections(userId);
  for (const c of conns.filter((x) => x.kind !== "lab")) {
    await syncConnection(c.id);
  }
  await runMonitoringSweep(userId);
  revalidatePath("/app");
  revalidatePath("/app/connections");
}

export async function connectAction(kind: ConnectionKind, adapter: AdapterKind = "mock") {
  const userId = await uid();
  await connectSource(userId, kind, adapter);
  await runMonitoringSweep(userId);
  revalidatePath("/app");
  revalidatePath("/app/connections");
}

export async function loadDemoLabAction() {
  const userId = await uid();
  await ingestLab(userId, { kind: "mock" });
  revalidatePath("/app/labs");
  revalidatePath("/app");
}

export async function importLabAction(formData: FormData) {
  const userId = await uid();
  const file = formData.get("file") as File | null;
  if (!file) return;
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const buf = Buffer.from(await file.arrayBuffer());
    await ingestLabPdf(userId, file.name, buf);
  } else {
    await ingestLab(userId, { kind: "file", filename: file.name, content: await file.text() });
  }
  revalidatePath("/app/labs");
  revalidatePath("/app");
}

export async function importRecordsAction(formData: FormData) {
  const userId = await uid();
  const file = formData.get("file") as File | null;
  if (!file) return;
  await importFile(userId, "records", { filename: file.name, content: await file.text() });
  await runMonitoringSweep(userId);
  revalidatePath("/app");
  revalidatePath("/app/connections");
  revalidatePath("/app/timeline");
}

export async function importWearableAction(formData: FormData) {
  const userId = await uid();
  const file = formData.get("file") as File | null;
  if (!file) return;
  await importFile(userId, "wearable", { filename: file.name, content: await file.text() });
  await runMonitoringSweep(userId);
  revalidatePath("/app");
  revalidatePath("/app/connections");
}

// ---- medications ----------------------------------------------------------
export async function addMedicationAction(formData: FormData) {
  const userId = await uid();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await addMedication(userId, {
    name,
    dose: String(formData.get("dose") ?? "") || undefined,
    schedule: String(formData.get("schedule") ?? "") || undefined,
    notes: String(formData.get("notes") ?? "") || undefined,
  });
  revalidatePath("/app/medications");
}

// ---- settings / account (confirm-gated) -----------------------------------
export async function setNotificationOptInAction(optIn: boolean, email?: string) {
  const userId = await uid();
  await updateSettings(userId, { notifyOptIn: optIn, notifyEmail: email });
  revalidatePath("/app/settings");
}

export async function exportDataAction(): Promise<string> {
  const userId = await uid();
  const data = await exportData(userId);
  return JSON.stringify(data, null, 2);
}

export async function deleteDataAction() {
  const userId = await uid();
  await deleteData(userId);
  redirect("/login");
}

// ---- reviews (mocked clinician-in-the-loop) -------------------------------
export async function resolveReviewAction(id: string) {
  await resolveReviewFlag(id);
  revalidatePath("/app/reviews");
}

export async function draftReviewAction(id: string) {
  await draftReviewerNote(id);
  revalidatePath("/app/reviews");
}

export async function requestVisitAction(note?: string) {
  const userId = await uid();
  await createReviewFlag(userId, "chat", {
    summary: note?.trim() || "Requested a clinician visit",
    details: "User requested a clinician review/visit (mocked booking).",
  });
  revalidatePath("/app/reviews");
}
