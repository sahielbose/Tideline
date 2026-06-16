import { describe, it, expect } from "vitest";
import { searchReference } from "../lib/services/reference";
import { respond } from "../lib/services/ai";

describe("reference retrieval (searchReference)", () => {
  it("ranks the right note for a query", () => {
    expect(searchReference("my resting heart rate keeps rising", 1)[0]?.id).toBe("resting-heart-rate");
    expect(searchReference("can you explain my cholesterol and LDL", 1)[0]?.id).toBe("lipids");
    expect(searchReference("fasting glucose and metabolic risk", 1)[0]?.id).toBe("fasting-glucose");
  });

  it("returns nothing for an unrelated query", () => {
    expect(searchReference("zxqw nonsense token", 2)).toEqual([]);
  });

  it("grounds a keyless reply with a curated reference note", async () => {
    const reply = await respond([{ role: "user", content: "my sleep has been poor lately" }]);
    expect(reply.content).toMatch(/Related reading/);
    expect(reply.content.toLowerCase()).toMatch(/sleep/);
  });

  it("does NOT append reference noise to an emergency reply", async () => {
    const reply = await respond([{ role: "user", content: "I have crushing chest pain" }]);
    expect(reply.triage).toBe("emergency");
    expect(reply.content).not.toMatch(/Related reading/);
  });
});
