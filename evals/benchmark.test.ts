import { describe, it, expect } from "vitest";
import { detectMetric } from "../lib/services/drift";
import { classifyRule } from "../lib/services/ai";
import { SEVERITY_RANK, type MetricSeriesPoint } from "../lib/types";
import { NOW, makeSeries, stable, drift } from "./helpers";
import thresholds from "./thresholds.json";

/**
 * Benchmark suite: computes recall/false-alarm on labeled fixtures and gates on
 * evals/thresholds.json. Prints a small table for the README benchmark.
 */
const caught = (series: MetricSeriesPoint[], metric: string) => {
  const s = detectMetric(metric, series, NOW).signal;
  return s ? SEVERITY_RANK[s.severity] >= SEVERITY_RANK.watch : false;
};

// --- drift positives (real declines that MUST be caught) -------------------
const POSITIVES: { metric: string; series: MetricSeriesPoint[] }[] = [
  { metric: "rhr", series: makeSeries(NOW, 70, drift(56, 70, 18, 0.6)) },
  { metric: "rhr", series: makeSeries(NOW, 70, drift(58, 80, 16, 0.5)) },
  { metric: "hrv", series: makeSeries(NOW, 70, drift(62, 42, 20, 1)) },
  { metric: "glucose", series: makeSeries(NOW, 90, drift(88, 108, 30, 1), 3) },
  { metric: "bp_systolic", series: makeSeries(NOW, 60, (d) => (d > 14 ? 117 : 128)) },
  { metric: "sleep", series: makeSeries(NOW, 60, drift(7.6, 6.0, 21, 0.1)) },
  { metric: "weight", series: makeSeries(NOW, 90, drift(170, 184, 80, 0.4), 2) },
  { metric: "spo2", series: makeSeries(NOW, 60, (d) => (d > 12 ? 98 : 93)) },
];

// --- drift negatives (stable; must NOT raise watch+) -----------------------
const NEGATIVES: { metric: string; series: MetricSeriesPoint[] }[] = [
  { metric: "rhr", series: makeSeries(NOW, 70, stable(58, 2)) },
  { metric: "hrv", series: makeSeries(NOW, 70, stable(55, 3)) },
  { metric: "glucose", series: makeSeries(NOW, 90, stable(88, 2), 3) },
  { metric: "spo2", series: makeSeries(NOW, 60, stable(98, 1)) },
  { metric: "sleep", series: makeSeries(NOW, 60, stable(7.8, 0.2)) },
  { metric: "weight", series: makeSeries(NOW, 90, stable(176, 0.6), 2) },
];

// --- red-flag labeled set --------------------------------------------------
const RF_POS = [
  "severe chest pain", "I can't breathe", "I think I'm having a stroke",
  "my speech is slurred and I'm numb", "bleeding heavily and it won't stop",
  "I want to kill myself", "worst headache of my life came on suddenly",
  "trouble breathing and my throat is closing",
];
const RF_NEG = [
  "mild headache for three days", "poor sleep lately", "explain my labs",
  "runny nose and sore throat", "knee aches after running", "feeling tired",
];

describe("benchmark — drift recall + false-alarm gate", () => {
  const recall = POSITIVES.filter((p) => caught(p.series, p.metric)).length / POSITIVES.length;
  const falseAlarm = NEGATIVES.filter((n) => caught(n.series, n.metric)).length / NEGATIVES.length;

  it("prints the drift benchmark", () => {
    // eslint-disable-next-line no-console
    console.log(`\n  drift recall: ${(recall * 100).toFixed(0)}%  false-alarm: ${(falseAlarm * 100).toFixed(0)}%  (n+=${POSITIVES.length}, n-=${NEGATIVES.length})`);
    expect(true).toBe(true);
  });

  it("meets the recall threshold (no missed declines)", () => {
    expect(recall).toBeGreaterThanOrEqual(thresholds.drift.minRecall);
  });

  it("meets the false-alarm threshold (no over-alarming)", () => {
    expect(falseAlarm).toBeLessThanOrEqual(thresholds.drift.maxFalseAlarmRate);
  });
});

describe("benchmark — red-flag recall + false-positive gate", () => {
  const recall = RF_POS.filter((m) => classifyRule(m).emergency).length / RF_POS.length;
  const fp = RF_NEG.filter((m) => classifyRule(m).emergency).length / RF_NEG.length;

  it("prints the red-flag benchmark", () => {
    // eslint-disable-next-line no-console
    console.log(`  red-flag recall: ${(recall * 100).toFixed(0)}%  false-positive: ${(fp * 100).toFixed(0)}%  (n+=${RF_POS.length}, n-=${RF_NEG.length})\n`);
    expect(true).toBe(true);
  });

  it("meets the recall threshold", () => {
    expect(recall).toBeGreaterThanOrEqual(thresholds.redflag.minRecall);
  });

  it("keeps false positives under the threshold", () => {
    expect(fp).toBeLessThanOrEqual(thresholds.redflag.maxFalsePositiveRate);
  });
});
