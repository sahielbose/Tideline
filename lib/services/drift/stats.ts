/**
 * Pure statistics helpers for the drift engine. No I/O, fully unit-tested.
 */

export function mean(xs: number[]): number {
  if (xs.length === 0) return NaN;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Median absolute deviation. */
export function mad(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const m = median(xs);
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Robust spread: scaled MAD (≈ std for normal data). Falls back to the sample
 * standard deviation, then to a small floor so we never divide by zero.
 */
export function robustSpread(xs: number[]): number {
  const scaled = 1.4826 * mad(xs);
  if (scaled > 1e-6) return scaled;
  const m = mean(xs);
  const variance = mean(xs.map((x) => (x - m) ** 2));
  const std = Math.sqrt(variance);
  return std > 1e-6 ? std : 1e-6;
}

export interface LinReg {
  slope: number; // y units per x unit
  intercept: number;
  /** Predict y at a given x. */
  predict: (x: number) => number;
}

/** Ordinary least squares of y on x. */
export function linreg(xs: number[], ys: number[]): LinReg {
  const n = xs.length;
  if (n < 2) {
    const c = ys[0] ?? 0;
    return { slope: 0, intercept: c, predict: () => c };
  }
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = my - slope * mx;
  return { slope, intercept, predict: (x: number) => slope * x + intercept };
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export const DAY_MS = 24 * 60 * 60 * 1000;

export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === "string" ? new Date(a) : a;
  const dbb = typeof b === "string" ? new Date(b) : b;
  return (dbb.getTime() - da.getTime()) / DAY_MS;
}
