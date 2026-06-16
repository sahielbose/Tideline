/**
 * A small, curated, original reference corpus + keyword retrieval (CONTEXT.md
 * §9 searchReference, §20: design so retrieval can be added without refactor).
 *
 * This is deliberately embedding-free and pgvector-free so it works with zero
 * keys. When embeddings become available it can be swapped behind searchReference
 * without changing callers. All text is original, general, and hedged — it
 * grounds answers to reduce hallucination; it is not medical advice.
 */
import { sql } from "../db/client";
import { embed } from "./embedder";

export interface ReferenceDoc {
  id: string;
  title: string;
  tags: string[];
  text: string;
}

export const REFERENCE_CORPUS: ReferenceDoc[] = [
  {
    id: "resting-heart-rate",
    title: "Resting heart rate trends",
    tags: ["rhr", "heart", "rate", "pulse", "cardiac", "rest"],
    text: "A typical resting heart rate is roughly 60–100 bpm, and many fit adults sit lower. What matters more than a single number is your own trend: a sustained rise over days to weeks can accompany illness, poor sleep, stress, dehydration, alcohol, or overtraining.",
  },
  {
    id: "hrv",
    title: "Heart rate variability (HRV)",
    tags: ["hrv", "variability", "recovery", "stress", "autonomic"],
    text: "Heart rate variability reflects the balance of your autonomic nervous system and tends to move opposite to resting heart rate. A falling trend often tracks with stress, poor sleep, illness, or heavy strain; it is highly individual, so compare against your own baseline.",
  },
  {
    id: "blood-pressure",
    title: "Blood pressure ranges",
    tags: ["bp", "blood", "pressure", "systolic", "diastolic", "hypertension"],
    text: "Blood pressure under about 120/80 is generally considered normal; readings that stay elevated over time matter more than a single high reading. Sleep, salt, stress, weight, and alcohol all influence it. Persistent elevation is worth discussing with a clinician.",
  },
  {
    id: "fasting-glucose",
    title: "Fasting glucose and metabolic health",
    tags: ["glucose", "sugar", "metabolic", "a1c", "diabetes", "fasting"],
    text: "Fasting glucose in the high end of the normal range, especially trending up alongside weight changes, can be an early metabolic signal. Diet, activity, sleep, and follow-up testing are the usual levers; interpretation belongs with a clinician.",
  },
  {
    id: "sleep",
    title: "Sleep and its downstream effects",
    tags: ["sleep", "insomnia", "tired", "rest", "fatigue"],
    text: "Most adults do best with about 7–9 hours of sleep. Short or fragmented sleep can raise resting heart rate, lower HRV, and make many other metrics look worse. A consistent wake time, less late screen time, and limiting late caffeine are high-yield first steps.",
  },
  {
    id: "headache",
    title: "Headaches: common vs concerning",
    tags: ["headache", "head", "migraine", "pain"],
    text: "Most headaches are benign and respond to rest, fluids, and a regular schedule. Treat as urgent if it is the worst headache of your life, comes on suddenly, or is paired with fever and a stiff neck, vision or speech changes, weakness, or confusion.",
  },
  {
    id: "lipids",
    title: "Cholesterol and lipid panels",
    tags: ["cholesterol", "ldl", "hdl", "triglycerides", "lipid", "lipids"],
    text: "On a lipid panel, lower LDL and triglycerides and higher HDL are generally favorable. Beyond the standard reference range, tighter optimal targets are sometimes used. Diet, activity, and follow-up testing are typical next steps; treatment decisions belong with a clinician.",
  },
  {
    id: "spo2",
    title: "Blood oxygen (SpO2)",
    tags: ["spo2", "oxygen", "saturation", "breathing"],
    text: "Resting blood oxygen is usually about 95–100%. Occasional dips can be measurement artifacts, but a persistent drop at rest, especially with breathlessness, is worth prompt attention.",
  },
  {
    id: "hydration",
    title: "Hydration and vitals",
    tags: ["hydration", "water", "dehydration", "fluids"],
    text: "Dehydration can nudge several metrics — raising resting heart rate and affecting blood pressure and how you feel. Steady fluid intake is a simple thing to rule in or out when numbers drift.",
  },
  {
    id: "when-to-seek-care",
    title: "When to seek care",
    tags: ["emergency", "care", "urgent", "clinician", "doctor"],
    text: "Seek emergency care for chest pain or pressure, trouble breathing, sudden weakness or numbness, slurred speech, severe bleeding, or thoughts of self-harm. For symptoms that persist, worsen, or worry you, a clinician review is the right next step.",
  },
];

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "is", "my", "i", "in", "on", "for", "with", "it", "this", "that", "have", "has", "been", "are", "be", "you", "your", "me"]);

function tokens(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t));
}

export interface ReferenceHit {
  id: string;
  title: string;
  snippet: string;
  score: number;
}

/** Keyword-overlap retrieval over the curated corpus (always available). */
export function searchReference(query: string, k = 2): ReferenceHit[] {
  const q = tokens(query);
  if (!q.length) return [];
  const scored = REFERENCE_CORPUS.map((doc) => {
    const hay = new Set([...doc.tags, ...tokens(doc.title), ...tokens(doc.text)]);
    let score = 0;
    for (const t of q) {
      if (doc.tags.includes(t)) score += 3;
      else if (hay.has(t)) score += 1;
    }
    return { id: doc.id, title: doc.title, snippet: doc.text, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

// ---- pgvector-backed semantic retrieval (optional) ------------------------
let embeddingsTable: boolean | null = null;

/** Cached check for whether the optional pgvector `embeddings` table exists. */
export async function hasEmbeddings(): Promise<boolean> {
  if (embeddingsTable !== null) return embeddingsTable;
  try {
    const r = await sql`select to_regclass('public.embeddings') as t`;
    embeddingsTable = Boolean(r[0]?.t);
  } catch {
    embeddingsTable = false;
  }
  return embeddingsTable;
}

/**
 * Unified retrieval: pgvector cosine search when the embeddings table exists,
 * otherwise the in-memory keyword search. Callers should use this.
 */
export async function retrieve(query: string, k = 2): Promise<ReferenceHit[]> {
  if (!query.trim()) return [];
  if (await hasEmbeddings()) {
    try {
      const e = JSON.stringify(await embed(query));
      const rows = await sql<{ ref_id: string; title: string; content: string; score: number }[]>`
        select ref_id, title, content, 1 - (embedding <=> ${e}::vector) as score
        from embeddings
        where kind = 'reference'
        order by embedding <=> ${e}::vector
        limit ${k}`;
      if (rows.length) {
        return rows.map((r) => ({ id: r.ref_id, title: r.title, snippet: r.content, score: Number(r.score) }));
      }
    } catch {
      // fall back to keyword on any vector error
    }
  }
  return searchReference(query, k);
}
