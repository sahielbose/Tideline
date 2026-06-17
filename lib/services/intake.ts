/**
 * Structured symptom intake (triage-only). A guided form collects a symptom,
 * onset, duration, severity, free-text context, and an affected body region.
 *
 * SAFETY: This is informational/triage support ONLY — it never diagnoses or
 * prescribes. Submitting an intake opens a review flag in the SIMULATED
 * clinician-in-the-loop queue (the reviewer is an AI persona, clearly labeled,
 * not a licensed clinician). Any severity figure shown is illustrative — not a
 * clinical or diagnostic measurement.
 */
import { createReviewFlag, draftReviewerNote } from "./reviews";
import { logAction } from "./audit";
import type { ReviewFlag } from "../db/schema";

/** Allowed body regions for the intake <select>. */
export const BODY_REGIONS = [
  "head",
  "chest",
  "abdomen",
  "back",
  "limbs",
  "skin",
  "general",
] as const;

export type BodyRegion = (typeof BODY_REGIONS)[number];

export interface IntakeFields {
  symptom: string;
  onset: string;
  duration: string;
  /** 1–10, illustrative — not a clinical or diagnostic measurement. */
  severity: number;
  context: string;
  region: BodyRegion;
}

/** True when the value is one of the known body regions. */
export function isBodyRegion(value: string): value is BodyRegion {
  return (BODY_REGIONS as readonly string[]).includes(value);
}

/**
 * Pure helper: normalize/validate raw form input into clean IntakeFields.
 * Clamps severity to 1–10, trims text, and falls back to "general" for an
 * unknown body region. Never throws on sparse input.
 */
export function normalizeIntake(raw: {
  symptom?: string;
  onset?: string;
  duration?: string;
  severity?: string | number;
  context?: string;
  region?: string;
}): IntakeFields {
  const rawSeverity =
    typeof raw.severity === "number" ? raw.severity : Number(raw.severity ?? "");
  const severity = Number.isFinite(rawSeverity)
    ? Math.min(10, Math.max(1, Math.round(rawSeverity)))
    : 5;
  const region = raw.region && isBodyRegion(raw.region) ? raw.region : "general";
  return {
    symptom: (raw.symptom ?? "").trim(),
    onset: (raw.onset ?? "").trim(),
    duration: (raw.duration ?? "").trim(),
    severity,
    context: (raw.context ?? "").trim(),
    region,
  };
}

/**
 * Pure helper: build the one-line summary + multi-line details string that the
 * review queue and the simulated reviewer note are derived from.
 */
export function buildIntakeSummary(fields: IntakeFields): { summary: string; details: string } {
  const symptom = fields.symptom || "Symptom report";
  const summary = `${symptom} (${fields.region}) — severity ${fields.severity}/10`;
  const lines = [
    `Symptom: ${fields.symptom || "—"}`,
    `Body region: ${fields.region}`,
    `Onset: ${fields.onset || "—"}`,
    `Duration: ${fields.duration || "—"}`,
    `Severity: ${fields.severity}/10 (illustrative — not a clinical or diagnostic measurement)`,
    `Context: ${fields.context || "—"}`,
  ];
  return { summary, details: lines.join("\n") };
}

/**
 * Submit a structured symptom intake: opens a review flag (source "intake") and
 * drafts a SIMULATED reviewer note for it. Triage-only — never a diagnosis.
 * Returns the created flag so callers can redirect to the review.
 */
export async function submitIntake(userId: string, fields: IntakeFields): Promise<ReviewFlag> {
  const clean = normalizeIntake(fields);
  const { summary, details } = buildIntakeSummary(clean);

  const flag = await createReviewFlag(
    userId,
    // Persisted verbatim in the (text) source column; the ai draft helper only
    // narrows for its own prompt, so an "intake" source is safe here.
    "intake" as "chat",
    {
      summary,
      details,
      symptom: clean.symptom,
      onset: clean.onset,
      duration: clean.duration,
      severity: clean.severity,
      context: clean.context,
      region: clean.region,
    },
  );

  await draftReviewerNote(userId, flag.id);
  await logAction(userId, "intake.submit", { flagId: flag.id, region: clean.region });
  return flag;
}
