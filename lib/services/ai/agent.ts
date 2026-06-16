/**
 * The AI doctor chat agent (CONTEXT.md §9.1). Reads the user's data (passed in
 * as a context block), does structured intake, and ends with a triage band.
 * Strict scope is enforced in the prompt (LLM path) and in the rule-based path.
 *
 * Both paths route emergencies/crisis to real care FIRST, regardless of the
 * conversational content.
 */
import type {
  AgentReply,
  ChatTurn,
  TriageBand,
  RedFlagVerdict,
} from "../../types";
import { hasLLM } from "../../config";
import { getProvider } from "./provider";
import { classifyRule } from "./redflag";
import { AGENT_SYSTEM, EMERGENCY_LEAD, CRISIS_RESOURCES } from "./prompts";

export interface AgentContext {
  name?: string;
  activeInsights?: { title: string; severity: string }[];
  latestMetrics?: { metric: string; display: string; value: string; status: string }[];
  labs?: { panelName: string; outOfRange: string[] }[];
  medications?: string[];
}

export const GREETING =
  "Hi, I'm your AI health companion. Tell me what's going on and I'll help you think it through. I'm not a licensed clinician, so for anything serious I'll point you to real care.";

const BANDS: TriageBand[] = ["self-care", "clinician-soon", "urgent", "emergency", "gathering"];

function lastUserMessage(history: ChatTurn[]): string {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}

function buildContextBlock(ctx: AgentContext): string {
  const parts: string[] = [];
  if (ctx.name) parts.push(`Patient: ${ctx.name}.`);
  if (ctx.latestMetrics?.length) {
    parts.push(
      "Recent metrics: " +
        ctx.latestMetrics
          .map((m) => `${m.display} ${m.value} (${m.status})`)
          .join("; ") +
        ".",
    );
  }
  if (ctx.activeInsights?.length) {
    parts.push(
      "Active monitoring insights: " +
        ctx.activeInsights.map((i) => `${i.title} [${i.severity}]`).join("; ") +
        ".",
    );
  }
  if (ctx.labs?.length) {
    parts.push(
      "Labs: " +
        ctx.labs
          .map(
            (l) =>
              `${l.panelName}${l.outOfRange.length ? ` (out of range: ${l.outOfRange.join(", ")})` : " (all in range)"}`,
          )
          .join("; ") +
        ".",
    );
  }
  if (ctx.medications?.length) parts.push(`Active medications: ${ctx.medications.join(", ")}.`);
  return parts.length ? `CONTEXT (the patient's own data):\n${parts.join("\n")}` : "";
}

function parseTriage(text: string): { content: string; triage: TriageBand } {
  const m = text.match(/TRIAGE:\s*([a-z-]+)\s*$/im);
  let triage: TriageBand = "gathering";
  let content = text;
  if (m) {
    const found = m[1].trim().toLowerCase() as TriageBand;
    if (BANDS.includes(found)) triage = found;
    content = text.slice(0, m.index).trim();
  }
  return { content, triage };
}

// ---- rule-based (zero-key) reply -----------------------------------------
function ruleReply(
  text: string,
  ctx: AgentContext,
  redFlag: RedFlagVerdict,
): AgentReply {
  const low = text.toLowerCase();

  if (redFlag.crisis) {
    return {
      content: `${CRISIS_RESOURCES}\n\nYou don't have to handle this alone, and I'm glad you said something. When you're safe, I'm here to help you keep track of how you're doing.`,
      triage: "emergency",
    };
  }
  if (redFlag.emergency) {
    return {
      content: `${EMERGENCY_LEAD} Once you're safe, I can help you keep track of what happened and follow up.`,
      triage: "emergency",
    };
  }

  const rhrInsight = ctx.activeInsights?.find((i) => /heart rate/i.test(i.title));

  if (/headache/.test(low)) {
    return {
      content:
        "Thanks for telling me. A few quick questions help: is the pain on one side or both, and is anything making it better or worse, like light, screens, or dehydration? Three days of headache is usually not an emergency, but if it's the worst headache of your life, comes with fever and a stiff neck, or any vision or speech changes, treat that as urgent. Otherwise, rest, fluids, and a regular sleep schedule are reasonable first steps. I'm not a clinician, so if it keeps up I can flag this for a review.",
      triage: "clinician-soon",
    };
  }
  if (/sleep/.test(low)) {
    const rhrLine = rhrInsight
      ? " Your dashboard already shows resting heart rate creeping up this week, which often tracks with short sleep."
      : "";
    return {
      content: `Poor sleep tends to show up across your other numbers.${rhrLine} A consistent wake time, less screen time before bed, and limiting late caffeine are the highest-yield changes. If low sleep continues for a few weeks, or you snore heavily and wake unrefreshed, that's worth a clinician review.`,
      triage: "self-care",
    };
  }
  if (/\blabs?\b|lipid|cholesterol|panel/.test(low)) {
    const lab = ctx.labs?.find((l) => l.outOfRange.length);
    const oor = lab?.outOfRange.length
      ? ` In your ${lab.panelName.toLowerCase()}, these are a little outside the usual range: ${lab.outOfRange.join(", ")}.`
      : "";
    return {
      content: `I can walk through your latest panel.${oor} This is general information, not a diagnosis. Diet, activity, and follow-up testing are the usual next steps. Want me to flag this panel for a clinician review?`,
      triage: "self-care",
    };
  }
  return {
    content:
      "Got it. Tell me a bit more so I can help: when did this start, how strong is it from 1 to 10, and is anything making it better or worse? I'll give you plain-language guidance and can flag anything for a licensed clinician review.",
    triage: "gathering",
  };
}

// ---- LLM reply ------------------------------------------------------------
async function llmReply(
  history: ChatTurn[],
  ctx: AgentContext,
  redFlag: RedFlagVerdict,
): Promise<AgentReply> {
  const contextBlock = buildContextBlock(ctx);
  const system = contextBlock ? `${AGENT_SYSTEM}\n\n${contextBlock}` : AGENT_SYSTEM;
  const messages = history
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => ({ role: t.role as "user" | "assistant", content: t.content }));
  const raw = await getProvider().complete({ system, messages, maxTokens: 700 });
  let { content, triage } = parseTriage(raw);

  // Safety overrides — the classifier wins over the conversational model.
  if (redFlag.crisis) {
    content = `${CRISIS_RESOURCES}\n\n${content}`.trim();
    triage = "emergency";
  } else if (redFlag.emergency && triage !== "emergency") {
    content = `${EMERGENCY_LEAD}\n\n${content}`.trim();
    triage = "emergency";
  }
  return { content, triage };
}

/**
 * Produce the assistant's reply for the current turn. `redFlag` should be the
 * verdict already computed for the latest user message; if omitted it is
 * recomputed with the rule-based matcher.
 */
export async function respond(
  history: ChatTurn[],
  ctx: AgentContext = {},
  redFlag?: RedFlagVerdict,
): Promise<AgentReply> {
  const text = lastUserMessage(history);
  const verdict = redFlag ?? classifyRule(text);
  if (!hasLLM) return ruleReply(text, ctx, verdict);
  try {
    return await llmReply(history, ctx, verdict);
  } catch {
    // Never fail the chat: fall back to the safe rule-based reply.
    return ruleReply(text, ctx, verdict);
  }
}
