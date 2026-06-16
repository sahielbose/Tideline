import { describe, it, expect } from "vitest";
import { detectMetric, detectDrift, computeBaseline } from "../lib/services/drift";
import { METRICS } from "../lib/metrics";
import { SEVERITY_RANK, type MetricSeriesPoint } from "../lib/types";
import { NOW, makeSeries, stable, drift } from "./helpers";

const sev = (s: { severity: import("../lib/types").Severity } | null) =>
  s ? SEVERITY_RANK[s.severity] : 0;

describe("drift engine — known-positive declines (the false-reassurance gate)", () => {
  it("catches a sustained resting-HR rise (must NOT be missed)", () => {
    // 56 stable, then a real ~12 bpm climb over three weeks.
    const series = makeSeries(NOW, 70, drift(56, 68, 21, 0.6));
    const r = detectMetric("rhr", series, NOW);
    expect(r.establishing).toBe(false);
    expect(r.signal).not.toBeNull();
    // A real decline must surface at least as "watch".
    expect(sev(r.signal)).toBeGreaterThanOrEqual(SEVERITY_RANK.watch);
  });

  it("catches a falling HRV trend in the concerning (downward) direction", () => {
    const series = makeSeries(NOW, 70, drift(60, 44, 20, 1));
    const r = detectMetric("hrv", series, NOW);
    expect(r.signal?.direction).toBe("down");
    expect(sev(r.signal)).toBeGreaterThanOrEqual(SEVERITY_RANK.watch);
  });

  it("escalates to ELEVATED when a single metric drifts very steeply", () => {
    // A dramatic lone climb should clear the elevated bar without help.
    const series = makeSeries(NOW, 70, drift(55, 82, 18, 0.5));
    const r = detectMetric("rhr", series, NOW);
    expect(sev(r.signal)).toBeGreaterThanOrEqual(SEVERITY_RANK.elevated);
  });
});

describe("drift engine — noisy but stable (must not over-alarm)", () => {
  it("does not flag a noisy-but-flat resting HR", () => {
    const series = makeSeries(NOW, 70, stable(58, 2));
    const r = detectMetric("rhr", series, NOW);
    expect(sev(r.signal)).toBeLessThan(SEVERITY_RANK.watch); // null or info only
    expect(r.signal === null || r.signal.severity === "info").toBe(true);
  });

  it("does not raise elevated/urgent on a stable metric", () => {
    const series = makeSeries(NOW, 70, stable(97, 1));
    const r = detectMetric("spo2", series, NOW);
    expect(sev(r.signal)).toBeLessThan(SEVERITY_RANK.elevated);
  });
});

describe("drift engine — reference crossing (sustained vs transient)", () => {
  it("flags a SUSTAINED systolic crossing above the reference", () => {
    const series = makeSeries(NOW, 60, (d) => (d > 14 ? 117 : 126));
    const r = detectMetric("bp_systolic", series, NOW);
    expect(r.signal).not.toBeNull();
    expect(sev(r.signal)).toBeGreaterThanOrEqual(SEVERITY_RANK.watch);
  });

  it("does NOT flag a single transient spike as a reference crossing", () => {
    // One spike to 140 five days ago; otherwise stable & in-range.
    const series = makeSeries(NOW, 60, (d) => (d === 5 ? 140 : 116));
    const r = detectMetric("bp_systolic", series, NOW);
    expect(r.signal?.type).not.toBe("reference-cross");
    expect(sev(r.signal)).toBeLessThan(SEVERITY_RANK.elevated);
  });
});

describe("drift engine — cross-signal combination scoring", () => {
  it("escalates resting HR to ELEVATED when HRV and sleep corroborate", () => {
    const series: Record<string, MetricSeriesPoint[]> = {
      rhr: makeSeries(NOW, 70, drift(58, 70, 16, 0.6)),
      hrv: makeSeries(NOW, 70, drift(58, 45, 20, 1)),
      sleep: makeSeries(NOW, 60, drift(7.4, 6.4, 20, 0.1)),
    };
    const report = detectDrift(series, NOW);
    const rhr = report.signals.find((s) => s.metric === "rhr");
    expect(rhr?.severity).toBe("elevated");
    expect(rhr?.evidence.contributing ?? []).toEqual(
      expect.arrayContaining(["hrv", "sleep"]),
    );
    expect(report.crossSignals.some((c) => c.metrics?.includes("rhr"))).toBe(true);
  });

  it("a lone watch-level metric stays watch without corroboration", () => {
    const report = detectDrift(
      { hrv: makeSeries(NOW, 70, drift(58, 45, 20, 1)) },
      NOW,
    );
    const hrv = report.signals.find((s) => s.metric === "hrv");
    expect(hrv?.severity).toBe("watch");
  });
});

describe("drift engine — baseline activation", () => {
  it("reports establishing baseline when there are too few readings", () => {
    const series = makeSeries(NOW, 6, () => 60, 2); // 4 readings, below minReadings(7)
    const r = detectMetric("rhr", series, NOW);
    expect(r.establishing).toBe(true);
    expect(r.signal).toBeNull();
  });

  it("computes a robust baseline that excludes the recent drift window", () => {
    const series = makeSeries(NOW, 70, drift(58, 71, 14, 0.5));
    const base = computeBaseline(series, METRICS.rhr, NOW);
    expect(base.active).toBe(true);
    // Baseline reflects the pre-drift center, not the elevated recent values.
    expect(base.center).toBeGreaterThan(55);
    expect(base.center).toBeLessThan(61);
  });
});
