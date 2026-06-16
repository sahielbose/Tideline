/**
 * Clinical-drift detection engine. Pure functions over time-series — no I/O,
 * fully unit-tested in /evals. See CONTEXT.md §8.
 *
 * The dangerous failure mode is a MISSED real decline (false reassurance), so
 * the engine is tuned to catch sustained drift while suppressing single-reading
 * noise. Thresholds live in the metric registry + DRIFT_CONFIG and are
 * illustrative starting points, not clinical truth.
 */
import { METRICS, type MetricDef } from "../../metrics";
import type {
  DriftSignal,
  DriftType,
  Severity,
  MetricSeriesPoint,
} from "../../types";
import { SEVERITY_RANK } from "../../types";
import { median, robustSpread, linreg, daysBetween, clamp } from "./stats";

export * from "./stats";

export interface BaselineResult {
  center: number;
  spread: number;
  n: number;
  active: boolean;
  windowStart: string;
  windowEnd: string;
}

export interface MetricDriftResult {
  metric: string;
  establishing: boolean;
  baseline: BaselineResult | null;
  signal: DriftSignal | null;
}

export interface DriftReport {
  signals: DriftSignal[];
  crossSignals: DriftSignal[];
  baselines: Record<string, BaselineResult>;
  establishing: string[];
}

export const DRIFT_CONFIG = {
  /** Trailing window (days) used for the trend fit and "recent" readings. */
  recentWindowDays: 21,
  /** Minimum readings in the trailing window to call a trend. */
  minSustain: 4,
  /** Minimum recent readings beyond a boundary to call a reference crossing. */
  refSustain: 3,
  /** Fraction of the reference range toward a boundary that triggers an info. */
  proximityFactor: 0.85,
  /** Trend score weights: emphasise total meaningful change over raw slope. */
  weightSlope: 0.5,
  weightDelta: 0.7,
  /**
   * score -> severity band cutoffs. A single metric on its own reaches at most
   * "watch" in the typical drift range; "elevated" is reserved for either a very
   * steep lone decline or — more commonly — a corroborated cross-signal cluster.
   */
  bands: { watch: 0.9, elevated: 1.9, urgent: 2.6 },
  /** Reference-crossing margin sensitivity. */
  refMarginK: 1.5,
};

function sorted(series: MetricSeriesPoint[]): MetricSeriesPoint[] {
  return [...series].sort(
    (a, b) => new Date(a.t).getTime() - new Date(b.t).getTime(),
  );
}

function bandFromScore(score: number): Severity | null {
  const b = DRIFT_CONFIG.bands;
  if (score >= b.urgent) return "urgent";
  if (score >= b.elevated) return "elevated";
  if (score >= b.watch) return "watch";
  return null;
}

function bumpBand(s: Severity, by = 1, cap: Severity = "urgent"): Severity {
  const order: Severity[] = ["info", "watch", "elevated", "urgent"];
  const i = clamp(order.indexOf(s) + by, 0, order.indexOf(cap));
  return order[i];
}

export function computeBaseline(
  series: MetricSeriesPoint[],
  def: MetricDef,
  now: Date,
): BaselineResult {
  const s = sorted(series);
  const windowStart = new Date(now.getTime() - def.baselineWindowDays * 864e5);
  const baselineEnd = new Date(now.getTime() - DRIFT_CONFIG.recentWindowDays * 864e5);
  let inWindow = s.filter((p) => {
    const t = new Date(p.t);
    return t >= windowStart && t <= baselineEnd;
  });
  // If excluding the recent window leaves too little, fall back to the whole
  // window (a young account still gets a provisional baseline).
  if (inWindow.length < def.minReadings) {
    inWindow = s.filter((p) => new Date(p.t) >= windowStart);
  }
  const vals = inWindow.map((p) => p.v);
  return {
    center: vals.length ? median(vals) : NaN,
    spread: vals.length ? robustSpread(vals) : NaN,
    n: vals.length,
    active: vals.length >= def.minReadings,
    windowStart: windowStart.toISOString(),
    windowEnd: baselineEnd.toISOString(),
  };
}

export function detectMetric(
  metric: string,
  series: MetricSeriesPoint[],
  now: Date,
): MetricDriftResult {
  const def = METRICS[metric];
  if (!def) return { metric, establishing: false, baseline: null, signal: null };

  const s = sorted(series);
  if (s.length < def.minReadings) {
    return { metric, establishing: true, baseline: null, signal: null };
  }

  const baseline = computeBaseline(s, def, now);
  if (!baseline.active || Number.isNaN(baseline.center)) {
    return { metric, establishing: true, baseline, signal: null };
  }

  const recent = s.filter(
    (p) => daysBetween(p.t, now) <= DRIFT_CONFIG.recentWindowDays,
  );
  const latestPt = s[s.length - 1];
  const latest = latestPt.v;
  const deltaFromBaseline = latest - baseline.center;

  const concernSign =
    def.concern === "high" ? 1 : def.concern === "low" ? -1 : Math.sign(deltaFromBaseline) || 1;
  const concerningDelta = deltaFromBaseline * concernSign; // >0 means worse

  // ---- trend fit over the recent window ---------------------------------
  const x0 = recent.length ? new Date(recent[0].t).getTime() : now.getTime();
  const xs = recent.map((p) => (new Date(p.t).getTime() - x0) / 864e5);
  const ys = recent.map((p) => p.v);
  const reg = linreg(xs, ys);
  const slopePerWeek = reg.slope * 7;
  const trendConcern = slopePerWeek * concernSign;

  const candidates: DriftSignal[] = [];

  // TREND DRIFT
  if (
    def.trendDeltaPerWeek &&
    recent.length >= DRIFT_CONFIG.minSustain &&
    trendConcern > 0
  ) {
    const relSlope = Math.abs(slopePerWeek) / def.trendDeltaPerWeek;
    const relDelta = def.clinicalDelta
      ? Math.abs(deltaFromBaseline) / def.clinicalDelta
      : relSlope;
    const score =
      DRIFT_CONFIG.weightSlope * relSlope + DRIFT_CONFIG.weightDelta * relDelta;
    const sev = bandFromScore(score);
    if (sev) {
      candidates.push(
        mkSignal(metric, "trend", sev, slopePerWeek, deltaFromBaseline, baseline, latest, def, recent.length, {
          slopePerWeek,
          summary: `${def.display} is ${slopePerWeek > 0 ? "rising" : "falling"} about ${Math.abs(slopePerWeek).toFixed(1)} ${def.unit}/week, now ${latest.toFixed(def.decimals)} ${def.unit} vs a baseline near ${baseline.center.toFixed(def.decimals)}.`,
        }),
      );
    }
  }

  // REFERENCE-RANGE CROSSING (sustained)
  const refSig = referenceCross(metric, def, recent, latest, baseline, concernSign);
  if (refSig) candidates.push(refSig);

  // PERSONAL ANOMALY (trend-adjusted residual, sustained 2+ readings)
  const anom = anomaly(metric, def, recent, reg, x0, baseline, latest, concernSign, now);
  if (anom) candidates.push(anom);

  // pick the highest-severity candidate (tie-break: ref > trend > anomaly)
  const typeRank: Record<DriftType, number> = {
    "reference-cross": 3,
    trend: 2,
    anomaly: 1,
    "cross-signal": 0,
  };
  let best: DriftSignal | null =
    candidates.sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        typeRank[b.type] - typeRank[a.type],
    )[0] ?? null;

  // PROXIMITY (info) — only if nothing stronger fired
  if (!best) {
    const prox = proximity(metric, def, latest, baseline, concernSign, deltaFromBaseline, recent.length);
    if (prox) best = prox;
  }

  return { metric, establishing: false, baseline, signal: best };
}

function mkSignal(
  metric: string,
  type: DriftType,
  severity: Severity,
  magnitude: number,
  deltaFromBaseline: number,
  baseline: BaselineResult,
  latest: number,
  def: MetricDef,
  n: number,
  extra: { slopePerWeek?: number; zScore?: number; summary: string },
): DriftSignal {
  return {
    metric,
    type,
    severity,
    magnitude,
    direction: deltaFromBaseline > 0 ? "up" : deltaFromBaseline < 0 ? "down" : "flat",
    windowStart: baseline.windowEnd,
    windowEnd: new Date().toISOString(),
    evidence: {
      baselineCenter: baseline.center,
      baselineSpread: baseline.spread,
      latest,
      refLow: def.refLow,
      refHigh: def.refHigh,
      slopePerWeek: extra.slopePerWeek,
      zScore: extra.zScore,
      nReadings: n,
      summary: extra.summary,
    },
  };
}

function referenceCross(
  metric: string,
  def: MetricDef,
  recent: MetricSeriesPoint[],
  latest: number,
  baseline: BaselineResult,
  concernSign: number,
): DriftSignal | null {
  if (def.refLow == null || def.refHigh == null) return null;
  const range = def.refHigh - def.refLow || 1;
  let beyond: number;
  let crossed: boolean;
  let marginRel: number;
  if (concernSign > 0) {
    beyond = recent.filter((p) => p.v > def.refHigh!).length;
    crossed = latest > def.refHigh;
    marginRel = (latest - def.refHigh) / range;
  } else {
    beyond = recent.filter((p) => p.v < def.refLow!).length;
    crossed = latest < def.refLow;
    marginRel = (def.refLow - latest) / range;
  }
  if (!crossed || beyond < DRIFT_CONFIG.refSustain) return null;
  const score = 1.0 + Math.max(0, marginRel) * DRIFT_CONFIG.refMarginK;
  const sev = bandFromScore(score) ?? "watch";
  const boundary = concernSign > 0 ? def.refHigh : def.refLow;
  return mkSignal(
    metric,
    "reference-cross",
    sev,
    latest - boundary,
    latest - baseline.center,
    baseline,
    latest,
    def,
    beyond,
    {
      summary: `${def.display} has stayed ${concernSign > 0 ? "above" : "below"} the reference ${boundary} ${def.unit} across ${beyond} recent readings (now ${latest.toFixed(def.decimals)}).`,
    },
  );
}

function anomaly(
  metric: string,
  def: MetricDef,
  recent: MetricSeriesPoint[],
  reg: ReturnType<typeof linreg>,
  x0: number,
  baseline: BaselineResult,
  latest: number,
  concernSign: number,
  now: Date,
): DriftSignal | null {
  if (!def.zThreshold || recent.length < 3 || baseline.spread <= 0) return null;
  const k = def.zThreshold;
  const last2 = recent.slice(-2);
  const beyond = last2.filter((p) => {
    const x = (new Date(p.t).getTime() - x0) / 864e5;
    const resid = (p.v - reg.predict(x)) * concernSign;
    return resid / baseline.spread >= k;
  });
  if (beyond.length < 2) return null;
  const xLast = (new Date(recent[recent.length - 1].t).getTime() - x0) / 864e5;
  const residual = latest - reg.predict(xLast);
  const z = (latest - baseline.center) / baseline.spread;
  const score = Math.abs(residual) / (baseline.spread * k);
  const sev = bandFromScore(0.9 + (score - 1) * 0.6) ?? "watch";
  return mkSignal(metric, "anomaly", sev, z, latest - baseline.center, baseline, latest, def, beyond.length, {
    zScore: z,
    summary: `${def.display} jumped to ${latest.toFixed(def.decimals)} ${def.unit}, about ${Math.abs(z).toFixed(1)} robust deviations from your baseline, across the last two readings.`,
  });
}

function proximity(
  metric: string,
  def: MetricDef,
  latest: number,
  baseline: BaselineResult,
  concernSign: number,
  deltaFromBaseline: number,
  n: number,
): DriftSignal | null {
  if (def.refLow == null || def.refHigh == null) return null;
  const range = def.refHigh - def.refLow;
  if (range <= 0) return null;
  let near = false;
  if (concernSign > 0) {
    const threshold = def.refLow + DRIFT_CONFIG.proximityFactor * range;
    near = latest >= threshold && latest <= def.refHigh;
  } else {
    const threshold = def.refHigh - DRIFT_CONFIG.proximityFactor * range;
    near = latest <= threshold && latest >= def.refLow;
  }
  if (!near) return null;
  return mkSignal(metric, "trend", "info", deltaFromBaseline, deltaFromBaseline, baseline, latest, def, n, {
    summary: `${def.display} is ${concernSign > 0 ? "near the top" : "near the bottom"} of the reference range at ${latest.toFixed(def.decimals)} ${def.unit} (still in range), worth keeping an eye on.`,
  });
}

// ---------------------------------------------------------------------------
// cross-signal patterns + corroboration
// ---------------------------------------------------------------------------
const CLUSTERS: { name: string; lead: string; members: string[]; label: string }[] = [
  {
    name: "autonomic",
    lead: "rhr",
    members: ["rhr", "hrv", "sleep"],
    label: "rising resting heart rate with falling HRV and short sleep",
  },
  {
    name: "metabolic",
    lead: "glucose",
    members: ["glucose", "weight", "hrv"],
    label: "rising fasting glucose alongside weight and HRV changes",
  },
];

function concerning(sig: DriftSignal | null | undefined): boolean {
  return !!sig && SEVERITY_RANK[sig.severity] >= SEVERITY_RANK.info;
}

export function detectDrift(
  seriesByMetric: Record<string, MetricSeriesPoint[]>,
  now: Date = new Date(),
): DriftReport {
  const results: Record<string, MetricDriftResult> = {};
  for (const metric of Object.keys(seriesByMetric)) {
    if (!METRICS[metric]) continue;
    results[metric] = detectMetric(metric, seriesByMetric[metric], now);
  }

  const signalByMetric: Record<string, DriftSignal> = {};
  const baselines: Record<string, BaselineResult> = {};
  const establishing: string[] = [];
  for (const r of Object.values(results)) {
    if (r.baseline) baselines[r.metric] = r.baseline;
    if (r.establishing) establishing.push(r.metric);
    if (r.signal) signalByMetric[r.metric] = r.signal;
  }

  const crossSignals: DriftSignal[] = [];
  for (const cluster of CLUSTERS) {
    const present = cluster.members.filter((m) => concerning(signalByMetric[m]));
    if (present.length < 2) continue;
    const contributing = present.filter((m) => m !== cluster.lead);
    const lead = signalByMetric[cluster.lead];
    if (lead) {
      lead.evidence.contributing = contributing;
      // Corroboration escalates the lead one band (capped at elevated for
      // Phase 1) — but only a real signal, never a mere "near range" info note.
      if (
        SEVERITY_RANK[lead.severity] >= SEVERITY_RANK.watch &&
        SEVERITY_RANK[lead.severity] < SEVERITY_RANK.elevated
      ) {
        lead.severity = bumpBand(lead.severity, 1, "elevated");
      }
    }
    const leadBaseline = baselines[cluster.lead] ?? Object.values(baselines)[0];
    if (leadBaseline) {
      crossSignals.push({
        metric: cluster.lead,
        metrics: present,
        type: "cross-signal",
        severity: lead ? lead.severity : "watch",
        magnitude: present.length,
        direction: "up",
        windowStart: leadBaseline.windowEnd,
        windowEnd: now.toISOString(),
        evidence: {
          baselineCenter: leadBaseline.center,
          baselineSpread: leadBaseline.spread,
          latest: signalByMetric[cluster.lead]?.evidence.latest ?? leadBaseline.center,
          nReadings: present.length,
          contributing: present,
          summary: `Cross-signal pattern (${cluster.name}): ${cluster.label}. ${present.length} related metrics are moving together.`,
        },
      });
    }
  }

  return {
    signals: Object.values(signalByMetric),
    crossSignals,
    baselines,
    establishing,
  };
}
