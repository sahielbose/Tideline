/**
 * Simulated reviewer (CONTEXT.md §9.5). Drafts a careful, conservative review
 * note for a review_flag. ALWAYS clearly labeled as simulated — never presented
 * as a real clinician (safety rule §10.8).
 */
import { hasLLM } from "../../config";
import { getProvider } from "./provider";
import { REVIEWER_SYSTEM } from "./prompts";

export interface ReviewContext {
  source: "chat" | "insight";
  summary: string;
  severity?: string;
  details?: string;
}

const LABEL = "_Simulated review — drafted by Tideline's AI reviewer persona, not a licensed clinician. For a real review, request a clinician._";

function ruleNote(ctx: ReviewContext): string {
  const lines: string[] = [];
  lines.push(LABEL);
  lines.push("");
  lines.push(`**Context:** ${ctx.summary}`);
  if (ctx.details) lines.push("");
  if (ctx.details) lines.push(ctx.details);
  lines.push("");
  lines.push("**Assessment (conservative):**");
  lines.push(
    "- The trend is worth tracking. Most short-term shifts like this are explained by sleep, stress, illness, hydration, or recent activity.",
  );
  lines.push(
    "- It does not, on its own, indicate an emergency. Watch for any new or severe symptoms and seek care promptly if they appear.",
  );
  lines.push("");
  lines.push("**Suggested next steps:**");
  lines.push("- Keep logging the metric and note sleep, stress, and any symptoms.");
  lines.push("- If the trend continues for another 1–2 weeks, see a clinician and bring this timeline.");
  lines.push("- Book a clinician visit sooner if symptoms develop.");
  return lines.join("\n");
}

export async function draftReviewerNote(ctx: ReviewContext): Promise<string> {
  if (!hasLLM) return ruleNote(ctx);
  try {
    const out = await getProvider().complete({
      system: REVIEWER_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Draft a conservative simulated review note.\nSource: ${ctx.source}\nSeverity: ${ctx.severity ?? "n/a"}\nSummary: ${ctx.summary}\nDetails: ${ctx.details ?? "none"}`,
        },
      ],
      maxTokens: 500,
    });
    const text = out.trim();
    return text ? `${LABEL}\n\n${text}` : ruleNote(ctx);
  } catch {
    return ruleNote(ctx);
  }
}
