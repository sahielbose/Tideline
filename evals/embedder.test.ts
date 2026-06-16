import { describe, it, expect } from "vitest";
import { localEmbed, EMBEDDING_DIM } from "../lib/services/embedder";
import { retrieve, hasEmbeddings } from "../lib/services/reference";

describe("local embedder", () => {
  it("produces a fixed-dimension, L2-normalized, deterministic vector", () => {
    const a = localEmbed("rising resting heart rate and poor sleep");
    const b = localEmbed("rising resting heart rate and poor sleep");
    expect(a.length).toBe(EMBEDDING_DIM);
    expect(a).toEqual(b); // deterministic
    const norm = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
    expect(norm).toBeCloseTo(1, 5);
  });

  it("scores related text closer than unrelated text (cosine)", () => {
    const cos = (x: number[], y: number[]) => x.reduce((s, v, i) => s + v * y[i], 0);
    const q = localEmbed("my heart rate keeps rising");
    const related = localEmbed("resting heart rate has been climbing");
    const unrelated = localEmbed("cholesterol and lipid panel results");
    expect(cos(q, related)).toBeGreaterThan(cos(q, unrelated));
  });
});

describe("retrieve() — pgvector when present, keyword fallback otherwise", () => {
  it("returns the right reference note either way", async () => {
    // Works whether or not the optional embeddings table exists.
    void (await hasEmbeddings());
    expect((await retrieve("my resting heart rate keeps climbing", 1))[0]?.id).toBe("resting-heart-rate");
    expect((await retrieve("explain my cholesterol and LDL", 1))[0]?.id).toBe("lipids");
    expect(await retrieve("zxqw nonsense token", 2)).toBeTruthy();
  });
});
