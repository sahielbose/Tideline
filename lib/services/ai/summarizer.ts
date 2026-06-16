/**
 * Signal explainer + monitoring summarizer (CONTEXT.md §9.4). Turns a raw
 * DriftSignal into a user-facing insight (title, hedged explanation, suggested
 * action) and rolls active signals into a short "what changed" digest.
 */
import type { DriftSignal, Severity } from "../../types";
import { METRICS } from "../../metrics";
import { hasLLM } from "../../config";
import { getProvider } from "./provider";
import { SUMMARIZER_SYSTEM } from "./prompts";

export interface ExplainedSignal {
  title: string;
  explanationMd: string;
  recommendedAction: string;
}

/** Hedged "what this can mean" context per metric. Never diagnostic. */
const MEANING: Record<string, string> = {
  rhr: "A rising resting heart rate can appear before an illness, or with poor sleep, stress, dehydration, alcohol, or overtraining.",
  hrv: "Falling heart rate variability often reflects stress, poor sleep, illness, or strain, and tends to move opposite to resting heart rate.",
  bp_systolic: "Blood pressure drifting up can reflect stress, salt, sleep, weight, or alcohol, and matters more when it stays up over time.",
  bp_diastolic: "Diastolic pressure creeping up is worth watching alongside the top number over several readings.",
  glucose: "Fasting glucose near the top of range can be an early metabolic signal, especially alongside weight and activity changes.",
  sleep: "Short sleep can raise resting heart rate, lower HRV, and make most other numbers look worse.",
  weight: "A steady weight change is worth noting alongside metabolic markers like glucose.",
  spo2: "A drop in blood oxygen at rest is worth attention if it persists.",
  steps: "A sustained drop in activity can both reflect and worsen how you feel.",
  temperature: "A shifted baseline temperature can accompany illness or other changes.",
};

const ACTION: Record<Severity, string> = {
  info: "Keep an eye on it. No action needed right now beyond your usual habits.",
  watch: "Worth monitoring. Consider sleep, hydration, stress, and recent activity, and re-check over the next week or two.",
  elevated: "Consider a clinician review if this continues. Bring the trend and its timing to the visit. You can flag it for review from here.",
  urgent: "Seek timely medical care to have this evaluated.",
};

function titleFor(signal: DriftSignal): string {
  const def = METRICS[signal.metric];
  const name = def?.display ?? signal.metric;
  if (signal.type === "cross-signal") return `${name} pattern across related metrics`;
  if (signal.type === "reference-cross") {
    return `${name} ${signal.direction === "up" ? "above" : "below"} the reference range`;
  }
  if (signal.severity === "info") return `${name} near the edge of your range`;
  return `${name} trending ${signal.direction === "down" ? "down" : "up"}`;
}

export function explainSignalRule(signal: DriftSignal): ExplainedSignal {
  const meaning = MEANING[signal.metric] ?? "";
  const corrob =
    signal.evidence.contributing?.length
      ? ` This is showing up alongside changes in ${signal.evidence.contributing
          .map((c) => METRICS[c]?.display ?? c)
          .join(" and ")}, which makes it more notable.`
      : "";
  const explanationMd = `${signal.evidence.summary}${meaning ? ` ${meaning}` : ""}${corrob}\n\nThis is general information, not a diagnosis.`;
  return {
    title: titleFor(signal),
    explanationMd,
    recommendedAction: ACTION[signal.severity],
  };
}

export async function explainSignal(signal: DriftSignal): Promise<ExplainedSignal> {
  if (!hasLLM) return explainSignalRule(signal);
  try {
    const out = await getProvider().complete({
      system: SUMMARIZER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Write a 2-3 sentence hedged, non-diagnostic explanation and a one-line suggested action for this monitoring signal. Do not invent data.\n\nMetric: ${signal.metric}\nSeverity: ${signal.severity}\nEvidence: ${JSON.stringify(signal.evidence)}`,
        },
      ],
      maxTokens: 300,
    });
    const text = out.trim();
    if (!text) return explainSignalRule(signal);
    return {
      title: titleFor(signal),
      explanationMd: `${text}\n\nThis is general information, not a diagnosis.`,
      recommendedAction: ACTION[signal.severity],
    };
  } catch {
    return explainSignalRule(signal);
  }
}

export function summarizeMonitoring(signals: DriftSignal[]): string {
  if (!signals.length) {
    return "Nothing notable changed this week. Your tracked metrics are holding near their baselines.";
  }
  const order: Severity[] = ["urgent", "elevated", "watch", "info"];
  const sorted = [...signals].sort(
    (a, b) => order.indexOf(a.severity) - order.indexOf(b.severity),
  );
  const top = sorted[0];
  const counts = order
    .map((s) => ({ s, n: signals.filter((x) => x.severity === s).length }))
    .filter((c) => c.n > 0)
    .map((c) => `${c.n} ${c.s}`)
    .join(", ");
  return `This week, ${signals.length} signal${signals.length === 1 ? "" : "s"} stood out (${counts}). The one to watch most: ${titleFor(top).toLowerCase()}. ${ACTION[top.severity]}`;
}
