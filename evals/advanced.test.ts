import { describe, it, expect } from "vitest";
import { computeReadiness } from "../lib/services/readiness";
import { computeBodySystems } from "../lib/services/body-systems";
import { computeRisk } from "../lib/services/risk";
import { computeCareGaps } from "../lib/services/care-gaps";
import { computeHabitCorrelations } from "../lib/services/habits";

describe("readiness score", () => {
  it("scores a favorable day high and a strained day lower (monotonic)", () => {
    const good = computeReadiness({
      metrics: { rhr: { latest: 55, center: 60, spread: 3 }, hrv: { latest: 65, center: 55, spread: 5 }, sleep: { latest: 7.8, center: 7.5, spread: 0.4 } },
    });
    const bad = computeReadiness({
      metrics: { rhr: { latest: 72, center: 58, spread: 3 }, hrv: { latest: 42, center: 58, spread: 4 }, sleep: { latest: 6, center: 7.5, spread: 0.4 } },
    });
    expect(good.score).toBeGreaterThan(75);
    expect(bad.score).toBeLessThan(good.score);
    expect(bad.contributors[0].subscore).toBeLessThanOrEqual(bad.contributors[bad.contributors.length - 1].subscore);
  });

  it("reconciles score to the mean of contributors and handles sparse data", () => {
    const r = computeReadiness({ metrics: { rhr: { latest: 64, center: 60, spread: 4 }, hrv: { latest: 50, center: 55, spread: 5 } } });
    const mean = Math.round(r.contributors.reduce((a, c) => a + c.subscore, 0) / r.contributors.length);
    expect(r.score).toBe(mean);
    expect(computeReadiness({ metrics: { rhr: { latest: 60, center: 60, spread: 3 } } }).available).toBe(1);
  });
});

describe("body-system rollups", () => {
  it("averages member scores, takes the worst status, and sorts worst-first", () => {
    const sys = computeBodySystems([
      { display: "LDL", system: "cardiovascular", status: "high" },
      { display: "HDL", system: "cardiovascular", status: "optimal" },
      { display: "ALT", system: "liver", status: "optimal" },
    ]);
    const cv = sys.find((s) => s.key === "cardiovascular")!;
    expect(cv.score).toBe(Math.round((30 + 100) / 2));
    expect(cv.status).toBe("elevated");
    expect(sys[0].key).toBe("cardiovascular"); // worst first
  });
});

describe("risk indicators", () => {
  it("counts metabolic-syndrome criteria and respects sex-specific HDL", () => {
    const r = computeRisk({ glucose: 105, systolic: 135, diastolic: 88, trig: 160, hdl: 38, sex: "male" });
    expect(r.metabolicSyndrome.criteriaMet).toBe(4);
    expect(r.metabolicSyndrome.meets).toBe(true);
    const fem = computeRisk({ hdl: 45, sex: "female" });
    expect(fem.metabolicSyndrome.criteria.find((c) => c.name.includes("HDL"))!.met).toBe(true);
    const male = computeRisk({ hdl: 45, sex: "male" });
    expect(male.metabolicSyndrome.criteria.find((c) => c.name.includes("HDL"))!.met).toBe(false);
  });

  it("bands cardiometabolic by markers outside optimal", () => {
    expect(computeRisk({ glucose: 85, systolic: 115, diastolic: 75, trig: 90, hdl: 65, a1c: 5.2, ldl: 80 }).cardiometabolic.band).toBe("favorable");
    expect(computeRisk({ glucose: 96, systolic: 128, diastolic: 82, trig: 120, hdl: 58, a1c: 5.6, ldl: 132 }).cardiometabolic.band).toBe("elevated");
  });
});

describe("care gaps (preventive screening)", () => {
  const now = new Date("2026-06-16T00:00:00Z");
  it("applies age/sex windows and computes due/overdue/ok", () => {
    const gaps = computeCareGaps({
      age: 46,
      sex: "female",
      lastDates: { lipid: new Date("2025-01-01"), glucose: null, bp: new Date("2026-05-01") },
      now,
    });
    const keys = gaps.map((g) => g.key);
    expect(keys).toContain("mammogram");
    expect(keys).not.toContain("prostate");
    expect(gaps.find((g) => g.key === "glucose")!.status).toBe("due");
    expect(gaps.find((g) => g.key === "lipid")!.status).toBe("ok");
  });

  it("excludes screenings below the minimum age", () => {
    const young = computeCareGaps({ age: 30, sex: "female", lastDates: {}, now });
    expect(young.map((g) => g.key)).not.toContain("mammogram");
    expect(young.map((g) => g.key)).not.toContain("colorectal");
  });

  it("returns nothing without an age", () => {
    expect(computeCareGaps({ age: null, sex: "female", lastDates: {}, now })).toEqual([]);
  });
});

describe("habit correlation", () => {
  const dayAvg = {
    rhr: { "06-01": 70, "06-02": 71, "06-03": 69, "05-01": 58, "05-02": 57, "05-03": 59, "05-04": 58 },
  };
  it("surfaces a tag's association and direction", () => {
    const c = computeHabitCorrelations(["rhr"], dayAvg, { "Poor sleep": ["06-01", "06-02", "06-03"] });
    expect(c[0].tag).toBe("Poor sleep");
    expect(c[0].n).toBe(3);
    expect(c[0].effects[0].deltaPct).toBeGreaterThan(0); // RHR higher on tagged days
  });
  it("suppresses small samples (< 3 tagged days)", () => {
    const c = computeHabitCorrelations(["rhr"], dayAvg, { "Travel": ["06-01", "06-02"] });
    expect(c).toEqual([]);
  });
});
