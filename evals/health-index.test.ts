import { describe, it, expect } from "vitest";
import { computeHealthIndex } from "../lib/services/health-index";

describe("health index — deterministic composite", () => {
  it("scores a healthy profile high and ages it younger", () => {
    const r = computeHealthIndex({
      metrics: { rhr: 55, hrv: 70, bp_systolic: 112, bp_diastolic: 70, glucose: 85, sleep: 8, spo2: 98 },
      ageYears: 40,
    });
    expect(r.index).toBeGreaterThanOrEqual(80);
    expect(r.label).toBe("Excellent");
    expect(r.healthAge).toBeLessThanOrEqual(40);
  });

  it("scores a drifting profile lower and surfaces the weakest metric", () => {
    const r = computeHealthIndex({
      metrics: { rhr: 78, hrv: 38, bp_systolic: 134, bp_diastolic: 86, glucose: 105, sleep: 6, spo2: 96 },
      ageYears: 40,
    });
    expect(r.index).toBeLessThan(70);
    expect(r.components[0].score).toBeLessThanOrEqual(r.components[r.components.length - 1].score);
    expect(r.healthAge).toBeGreaterThanOrEqual(40);
  });

  it("degrades gracefully with sparse data and never throws", () => {
    const r = computeHealthIndex({ metrics: { rhr: 60 } });
    expect(r.available).toBe(1);
    expect(r.healthAge).toBeNull();
    expect(r.index).toBeGreaterThan(0);
  });

  it("clamps subscores to 0-100", () => {
    const r = computeHealthIndex({ metrics: { rhr: 200, hrv: 5, glucose: 400 } });
    for (const c of r.components) {
      expect(c.score).toBeGreaterThanOrEqual(0);
      expect(c.score).toBeLessThanOrEqual(100);
    }
  });
});
