/**
 * Text embedder behind a small interface (CONTEXT.md §9, §20: retrieval can be
 * added without refactor). The default is a deterministic, dependency-free local
 * embedder (a hashed bag-of-tokens + character trigrams, L2-normalized) so the
 * pgvector retrieval pipeline works with ZERO external keys.
 *
 * To upgrade to true semantic embeddings, implement the `provider` branch
 * (e.g. a local Ollama model or a hosted embeddings API) — keep the output
 * dimension equal to EMBEDDING_DIM or change it in scripts/embeddings.ts.
 */
export const EMBEDDING_DIM = 256;

function bucket(token: string): number {
  let h = 2166136261;
  for (let i = 0; i < token.length; i++) {
    h ^= token.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % EMBEDDING_DIM;
}

function trigrams(token: string): string[] {
  if (token.length < 3) return [token];
  const out: string[] = [];
  for (let i = 0; i <= token.length - 3; i++) out.push(token.slice(i, i + 3));
  return out;
}

export function localEmbed(text: string): number[] {
  const v = new Array(EMBEDDING_DIM).fill(0);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1);
  for (const t of tokens) {
    v[bucket(t)] += 2; // whole-token signal
    for (const g of trigrams(t)) v[bucket("#" + g)] += 1; // fuzzy/substring signal
  }
  const norm = Math.sqrt(v.reduce((a, b) => a + b * b, 0)) || 1;
  return v.map((x) => x / norm);
}

export async function embed(text: string): Promise<number[]> {
  // Single seam for future providers (Ollama / hosted). Default: local.
  return localEmbed(text);
}
