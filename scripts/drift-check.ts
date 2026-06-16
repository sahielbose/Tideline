/**
 * Dev harness: build the mock series and print what the drift engine detects.
 * Not a test — used to tune thresholds. `tsx scripts/drift-check.ts`
 */
import { buildBiometricSeries } from "../lib/adapters/mock";
import { detectDrift } from "../lib/services/drift";
import type { MetricSeriesPoint } from "../lib/types";

const now = new Date();
const raw = buildBiometricSeries(now);
const series: Record<string, MetricSeriesPoint[]> = {};
for (const [metric, pts] of Object.entries(raw)) {
  series[metric] = pts.map((p) => ({ t: p.effectiveAt, v: p.value }));
}

const report = detectDrift(series, now);

import { METRICS } from "../lib/metrics";
console.log("\n=== per-metric signals ===");
for (const metric of Object.keys(series)) {
  const sig = report.signals.find((s) => s.metric === metric);
  const base = report.baselines[metric];
  const def = METRICS[metric];
  const latest = series[metric][series[metric].length - 1].v;
  const baseStr = base ? base.center.toFixed(2) : "n/a";
  if (sig) {
    const spw = sig.evidence.slopePerWeek;
    const relSlope = spw && def.trendDeltaPerWeek ? Math.abs(spw) / def.trendDeltaPerWeek : 0;
    const relDelta = def.clinicalDelta ? Math.abs(sig.evidence.latest - (base?.center ?? 0)) / def.clinicalDelta : 0;
    const score = 0.5 * relSlope + 0.7 * relDelta;
    console.log(
      `${metric.padEnd(13)} latest=${String(latest).padStart(7)} base=${baseStr.padStart(7)} -> ${sig.severity.toUpperCase().padEnd(8)} [${sig.type.padEnd(15)}] spw=${(spw ?? 0).toFixed(2).padStart(6)} relSlope=${relSlope.toFixed(2)} relDelta=${relDelta.toFixed(2)} score=${score.toFixed(2)} ${sig.evidence.contributing ? "corrob:" + sig.evidence.contributing.join("+") : ""}`,
    );
  } else {
    console.log(
      `${metric.padEnd(13)} latest=${String(latest).padStart(7)} base=${baseStr.padStart(7)} -> normal`,
    );
  }
}

console.log("\n=== cross signals ===");
for (const c of report.crossSignals) {
  console.log(`${c.metric} (${c.severity}) <- ${c.metrics?.join(", ")}`);
}
console.log("\nestablishing:", report.establishing.join(", ") || "(none)");
