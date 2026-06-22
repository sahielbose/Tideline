/**
 * Red-flag classifier (CONTEXT.md §9.2, §10.3). Runs on EVERY inbound user
 * message, independent of the main agent. Recall on true emergencies is the
 * priority. The rule-based matcher is always run as a recall floor; when an LLM
 * is configured its verdict is OR-merged so the keyword floor can never be lost.
 */
import type { RedFlagVerdict, RedFlagCategory } from "../../types";
import { hasLLM } from "../../settings";
import { getProvider } from "./provider";
import { CLASSIFIER_SYSTEM } from "./prompts";

interface Pattern {
  re: RegExp;
  category: RedFlagCategory;
  crisis?: boolean;
}

// Order matters: crisis first, then by clinical severity.
const PATTERNS: Pattern[] = [
  // self-harm / crisis
  { re: /\bsuicid/i, category: "self-harm", crisis: true },
  { re: /\bkill (myself|me)\b/i, category: "self-harm", crisis: true },
  { re: /\bend (my life|it all|things)\b/i, category: "self-harm", crisis: true },
  { re: /\b(want|going) to die\b/i, category: "self-harm", crisis: true },
  { re: /\bdon'?t want to (live|be here|exist)\b/i, category: "self-harm", crisis: true },
  { re: /\b(harm|hurt|cut) (myself|my self)\b/i, category: "self-harm", crisis: true },
  { re: /\bself[\s-]?harm\b/i, category: "self-harm", crisis: true },
  { re: /\bno reason to live\b/i, category: "self-harm", crisis: true },
  { re: /\boverdos/i, category: "self-harm", crisis: true },
  // cardiac
  { re: /\bchest (pain|pressure|tightness|discomfort)\b/i, category: "cardiac" },
  { re: /\bpain in (my )?chest\b/i, category: "cardiac" },
  { re: /\bcrushing\b.*\bchest\b/i, category: "cardiac" },
  { re: /\bheart attack\b/i, category: "cardiac" },
  // respiratory
  { re: /\bcan'?t breathe\b/i, category: "respiratory" },
  { re: /\bcannot breathe\b/i, category: "respiratory" },
  { re: /\b(trouble|difficulty|hard) breathing\b/i, category: "respiratory" },
  { re: /\b(short(ness)? of breath)\b/i, category: "respiratory" },
  { re: /\bstruggling to breathe\b/i, category: "respiratory" },
  { re: /\bchoking\b/i, category: "respiratory" },
  { re: /\banaphyla/i, category: "respiratory" },
  { re: /\bthroat (closing|swelling)\b/i, category: "respiratory" },
  // neurological
  { re: /\bstroke\b/i, category: "neurological" },
  { re: /\bslurred? speech\b/i, category: "neurological" },
  { re: /\bslurr/i, category: "neurological" },
  { re: /\bface (is )?droop/i, category: "neurological" },
  { re: /\bnumb(?!er)/i, category: "neurological" },
  { re: /\bweak(ness)? on one side\b/i, category: "neurological" },
  { re: /\bsudden(ly)? (confus|weak|numb)/i, category: "neurological" },
  { re: /\bworst headache\b/i, category: "neurological" },
  { re: /\bseizure\b/i, category: "neurological" },
  { re: /\b(passed out|fainted|faint|unconscious|unresponsive)\b/i, category: "neurological" },
  // bleeding
  { re: /\bsevere(ly)? bleed/i, category: "bleeding" },
  { re: /\bbleeding (heavily|a lot|badly)\b/i, category: "bleeding" },
  { re: /\bwon'?t stop bleeding\b/i, category: "bleeding" },
  { re: /\bcoughing up blood\b/i, category: "bleeding" },
  { re: /\b(vomiting|throwing up) blood\b/i, category: "bleeding" },
];

export function classifyRule(text: string): RedFlagVerdict {
  const matched: string[] = [];
  let category: RedFlagCategory = "none";
  let crisis = false;
  let emergency = false;
  for (const p of PATTERNS) {
    if (p.re.test(text)) {
      matched.push(p.re.source);
      emergency = true;
      if (p.crisis) {
        crisis = true;
        category = "self-harm";
        break; // crisis wins outright
      }
      if (category === "none") category = p.category;
    }
  }
  return {
    emergency,
    category,
    crisis,
    confidence: crisis ? 0.97 : emergency ? 0.9 : 0.6,
    matched,
  };
}

async function classifyLLM(text: string): Promise<RedFlagVerdict | null> {
  try {
    const raw = await getProvider().complete({
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: text }],
      maxTokens: 120,
      temperature: 0,
    });
    const json = raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1);
    const v = JSON.parse(json);
    return {
      emergency: Boolean(v.emergency),
      category: (v.category ?? "none") as RedFlagCategory,
      crisis: Boolean(v.crisis),
      confidence: typeof v.confidence === "number" ? v.confidence : 0.7,
    };
  } catch {
    return null; // fall back to the rule verdict
  }
}

export async function classifyRedFlags(text: string): Promise<RedFlagVerdict> {
  const rule = classifyRule(text);
  if (!(await hasLLM())) return rule;
  const llm = await classifyLLM(text);
  if (!llm) return rule;
  // OR-merge: never lose the keyword recall floor.
  const emergency = rule.emergency || llm.emergency;
  const crisis = rule.crisis || llm.crisis;
  return {
    emergency,
    crisis,
    category: crisis ? "self-harm" : llm.category !== "none" ? llm.category : rule.category,
    confidence: Math.max(rule.confidence, llm.confidence),
    matched: rule.matched,
  };
}
