/**
 * Lab explainer (CONTEXT.md §9.3). Per-marker plain-English read, out-of-range
 * flags, hedged trend, and a non-prescriptive next step. The rule-based path
 * never invents markers — it only describes what was passed in.
 */
import { hasLLM } from "../../config";
import { getProvider } from "./provider";
import { LAB_SYSTEM, NOT_A_PROVIDER } from "./prompts";
import { optimalFor, markerStatus } from "../../lab-reference";

export interface LabMarkerInput {
  code: string;
  display: string;
  value: number;
  unit: string;
  refLow?: number | null;
  refHigh?: number | null;
  flag?: "in" | "low" | "high";
}

export interface LabPanelInput {
  panelName: string;
  collectedAt: string | Date;
  markers: LabMarkerInput[];
}

export function flagFor(m: LabMarkerInput): "in" | "low" | "high" {
  if (m.flag) return m.flag;
  if (m.refHigh != null && m.value > m.refHigh) return "high";
  if (m.refLow != null && m.value < m.refLow) return "low";
  return "in";
}

function rangeText(m: LabMarkerInput): string {
  if (m.refLow != null && m.refHigh != null) return `${m.refLow}–${m.refHigh} ${m.unit}`;
  if (m.refHigh != null) return `under ${m.refHigh} ${m.unit}`;
  if (m.refLow != null) return `over ${m.refLow} ${m.unit}`;
  return "no standard range";
}

function ruleExplain(panel: LabPanelInput, priors?: Record<string, number>): string {
  const lines: string[] = [];
  const collected = new Date(panel.collectedAt).toLocaleDateString();
  lines.push(`Here is a plain-language read of your **${panel.panelName}** (collected ${collected}). ${NOT_A_PROVIDER}`);
  lines.push("");

  const outOfRange: string[] = [];
  const suboptimal: string[] = [];
  for (const m of panel.markers) {
    const opt = optimalFor(m.code, m.display);
    const st = markerStatus(m.value, m.refLow, m.refHigh, opt?.low, opt?.high);
    let status: string;
    if (st === "high") {
      status = `above the reference range (${rangeText(m)})`;
      outOfRange.push(m.display);
    } else if (st === "low") {
      status = `below the reference range (${rangeText(m)})`;
      outOfRange.push(m.display);
    } else if (st === "optimal") {
      status = `within range and at an optimal level (${rangeText(m)})`;
    } else if (st === "suboptimal") {
      status = `within the standard range (${rangeText(m)}) but outside the tighter optimal target`;
      suboptimal.push(m.display);
    } else {
      status = `within range (${rangeText(m)})`;
    }
    let trend = "";
    const prior = priors?.[m.code];
    if (prior != null && prior !== m.value) {
      trend = ` This has drifted ${m.value > prior ? "up" : "down"} from a previous ${prior} ${m.unit}.`;
    }
    lines.push(`- **${m.display}: ${m.value} ${m.unit}** — ${status}.${trend}`);
  }

  lines.push("");
  if (suboptimal.length) {
    lines.push(
      `**Toward optimal:** ${suboptimal.join(", ")} ${suboptimal.length === 1 ? "is" : "are"} in the standard range but not yet at the tighter optimal/longevity target — often nudge-able with lifestyle.`,
    );
  }
  if (outOfRange.length) {
    lines.push(
      `**What stands out:** ${outOfRange.join(", ")} ${outOfRange.length === 1 ? "is" : "are"} outside the usual range. This is common and often manageable, but it could suggest something worth discussing.`,
    );
    lines.push(
      `**A reasonable next step:** consider sharing this panel with a clinician to interpret it in the context of your history, and ask whether a repeat test or lifestyle changes make sense. You can flag this panel for review from here.`,
    );
  } else {
    lines.push(`**What stands out:** nothing is outside the usual range on this panel, which is reassuring.`);
    lines.push(`**A reasonable next step:** keep your usual follow-up schedule.`);
  }
  lines.push("");
  lines.push("_This is general information, not a diagnosis._");
  return lines.join("\n");
}

export async function explainLab(
  panel: LabPanelInput,
  priors?: Record<string, number>,
): Promise<string> {
  if (!hasLLM) return ruleExplain(panel, priors);
  try {
    const serialized = panel.markers
      .map(
        (m) =>
          `${m.display}: ${m.value} ${m.unit} (range ${rangeText(m)}, flag ${flagFor(m)})${priors?.[m.code] != null ? `, prior ${priors[m.code]}` : ""}`,
      )
      .join("\n");
    const out = await getProvider().complete({
      system: LAB_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Panel: ${panel.panelName}, collected ${new Date(panel.collectedAt).toLocaleDateString()}.\nMarkers:\n${serialized}\n\nExplain this panel.`,
        },
      ],
      maxTokens: 800,
    });
    let text = out.trim();
    if (!text) return ruleExplain(panel, priors);
    if (!/not a diagnosis/i.test(text)) {
      text += "\n\n_This is general information, not a diagnosis._";
    }
    return text;
  } catch {
    return ruleExplain(panel, priors);
  }
}
