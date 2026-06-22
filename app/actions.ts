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
  logManualReadings,
  addManualLabPanel,
  resetHealthData,
  addMedication,
  medicationInfo,
  addCarePlanTask,
  setCarePlanTaskStatus,
  deleteCarePlanTask,
  toggleHabit,
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

// Ownership is enforced inside the service getters/mutations (they take userId
// and scope every query), so the actions just pass the current user's id.

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
  await acknowledgeInsight(await uid(), id);
  revalidatePath("/app");
  revalidatePath("/app/insights");
}

export async function flagInsightAction(id: string) {
  await flagInsight(await uid(), id);
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

// ---- manual entry (real data, typed by the user) --------------------------
function readingDateISO(raw: string): string {
  const s = raw.trim();
  if (!s) return new Date().toISOString();
  // A date-only value (YYYY-MM-DD) must be read in LOCAL time, not UTC, or it
  // shifts back a day in negative-offset zones. datetime-local strings already
  // parse as local, so only bare dates need the explicit midnight suffix.
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00` : s;
  const d = new Date(normalized);
  return (Number.isNaN(d.getTime()) ? new Date() : d).toISOString();
}

/** Log one metric reading (or a blood-pressure pair) by hand. */
export async function logReadingAction(formData: FormData) {
  const userId = await uid();
  const metric = String(formData.get("metric") ?? "").trim();
  const at = readingDateISO(String(formData.get("at") ?? ""));

  const readings: { code: string; value: number; effectiveAt: string }[] = [];
  if (metric === "bp") {
    const sys = Number(formData.get("value"));
    const dia = Number(formData.get("value2"));
    if (Number.isFinite(sys)) readings.push({ code: "bp_systolic", value: sys, effectiveAt: at });
    if (Number.isFinite(dia)) readings.push({ code: "bp_diastolic", value: dia, effectiveAt: at });
  } else if (metric) {
    const value = Number(formData.get("value"));
    if (Number.isFinite(value)) readings.push({ code: metric, value, effectiveAt: at });
  }

  const n = await logManualReadings(userId, readings);
  if (n > 0) await runMonitoringSweep(userId);
  revalidatePath("/app");
  revalidatePath("/app/log");
  revalidatePath("/app/trends");
  revalidatePath("/app/timeline");
  revalidatePath("/app/biometrics");
}

/** Add a lab panel typed in by hand (panel name, date, marker rows). */
export async function addManualLabAction(formData: FormData) {
  const userId = await uid();
  const panelName = String(formData.get("panelName") ?? "").trim() || "Lab panel";
  const collectedAt = readingDateISO(String(formData.get("collectedAt") ?? ""));

  const names = formData.getAll("mname").map(String);
  const values = formData.getAll("mvalue").map(String);
  const units = formData.getAll("munit").map(String);
  const lows = formData.getAll("mreflow").map(String);
  const highs = formData.getAll("mrefhigh").map(String);

  const num = (s: string | undefined) =>
    s != null && s.trim() !== "" && Number.isFinite(Number(s)) ? Number(s) : undefined;

  const markers = names
    .map((name, i) => ({
      code: "",
      display: name.trim(),
      value: Number(values[i]),
      unit: (units[i] ?? "").trim(),
      refLow: num(lows[i]),
      refHigh: num(highs[i]),
    }))
    .filter((m) => m.display && Number.isFinite(m.value));

  if (!markers.length) return;
  await addManualLabPanel(userId, { panelName, collectedAt, markers });
  revalidatePath("/app/labs");
  revalidatePath("/app");
  revalidatePath("/app/log");
}

/** Clear demo/mock health data so the account starts from a clean slate. */
export async function resetHealthDataAction() {
  const userId = await uid();
  await resetHealthData(userId);
  revalidatePath("/app");
  revalidatePath("/app/log");
  revalidatePath("/app/trends");
  revalidatePath("/app/timeline");
  revalidatePath("/app/labs");
  revalidatePath("/app/connections");
  revalidatePath("/app/insights");
  revalidatePath("/app/reviews");
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

export async function medInfoAction(name: string): Promise<string> {
  await uid();
  return medicationInfo(name);
}

// ---- care-plan tasks ------------------------------------------------------
export async function addCarePlanTaskAction(formData: FormData) {
  const userId = await uid();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await addCarePlanTask(userId, { title, detail: String(formData.get("detail") ?? "") || undefined });
  revalidatePath("/app/plan");
}

export async function addTaskFromInsightAction(insightId: string, title: string, metric: string | null) {
  const userId = await uid();
  await addCarePlanTask(userId, { title, sourceInsightId: insightId, metric });
  revalidatePath("/app/plan");
}

export async function toggleCarePlanTaskAction(id: string, done: boolean) {
  await setCarePlanTaskStatus(await uid(), id, done ? "done" : "todo");
  revalidatePath("/app/plan");
}

export async function deleteCarePlanTaskAction(id: string) {
  await deleteCarePlanTask(await uid(), id);
  revalidatePath("/app/plan");
}

// ---- habit tags -----------------------------------------------------------
export async function toggleHabitAction(tag: string) {
  await toggleHabit(await uid(), tag);
  revalidatePath("/app/habits");
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
  await resolveReviewFlag(await uid(), id);
  revalidatePath("/app/reviews");
}

export async function draftReviewAction(id: string) {
  await draftReviewerNote(await uid(), id);
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
