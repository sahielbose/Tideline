/**
 * Longevity panel (route /app/longevity). Produces an ILLUSTRATIVE cardiovascular
 * risk band, a rough percentile comparison vs a tiny built-in reference table, and
 * a plain-English methodology summary for a "health age" style view.
 *
 * SAFETY: Everything here is illustrative and NON-DIAGNOSTIC. The cardio band is
 * NOT a real ASCVD percentage and must never be presented as one. Nothing here
 * diagnoses, prescribes, or replaces a licensed clinician.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { users, type User } from "../db/schema";
import { getLatestByMetric } from "./metrics";
import { getBiomarkers } from "./labs";
import { logAction } from "./audit";

// ---- types -----------------------------------------------------------------

export type CardioBand = "favorable" | "watch" | "elevated";

export interface CardioRisk {
  /** Illustrative 0-100 score (NOT a clinical percentage). */
  score: number;
  band: CardioBand;
  label: string;
  /** Plain-English contributors, worst-first. */
  drivers: string[];
  /** Inputs that were missing (so the page can prompt the user). */
  missing: string[];
}

export interface CardioInput {
  age: number | null;
  sex: "male" | "female" | null;
  systolic: number | null;
  totalChol: number | null;
  hdl: number | null;
}

export interface PercentileRow {
  key: string;
  display: string;
  value: number;
  unit: string;
  /** 0-100, higher = the value sits higher in the reference distribution. */
  percentile: number;
  /** Whether a higher percentile is generally regarded as better. */
  higherIsBetter: boolean;
  note: string;
}

export interface Longevity {
  cardio: CardioRisk;
  percentiles: PercentileRow[];
  methodology: string[];
  hasData: boolean;
}

// ---- reference table (rough, illustrative population means) -----------------
// Intentionally simple mean/sd pairs. These are NOT validated clinical norms;
// they exist only to place a value loosely within a spread for illustration.
interface RefStat {
  display: string;
  unit: string;
  mean: number;
  sd: number;
  higherIsBetter: boolean;
  note: string;
}

const REFERENCE: Record<string, RefStat> = {
  rhr: {
    display: "Resting heart rate",
    unit: "bpm",
    mean: 66,
    sd: 9,
    higherIsBetter: false,
    note: "Lower resting heart rate generally tracks with cardiovascular fitness.",
  },
  hrv: {
    display: "Heart rate variability",
    unit: "ms",
    mean: 45,
    sd: 18,
    higherIsBetter: true,
    note: "Higher HRV is often associated with recovery and autonomic balance.",
  },
  vo2max: {
    display: "VO₂ max",
    unit: "ml/kg/min",
    mean: 38,
    sd: 9,
    higherIsBetter: true,
    note: "Higher estimated VO₂ max reflects greater aerobic capacity.",
  },
  glucose: {
    display: "Fasting glucose",
    unit: "mg/dL",
    mean: 92,
    sd: 12,
    higherIsBetter: false,
    note: "Lower fasting glucose within a normal range is generally preferable.",
  },
};

// ---- pure compute ----------------------------------------------------------

/** Standard normal CDF (Abramowitz & Stegun 7.1.26 approximation). */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp((-z * z) / 2);
  let p =
    d *
    t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return 1 - p;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function bandFor(score: number): { band: CardioBand; label: string } {
  if (score < 34) return { band: "favorable", label: "Favorable" };
  if (score < 62) return { band: "watch", label: "Watch" };
  return { band: "elevated", label: "Elevated" };
}

/**
 * PURE. Illustrative cardiovascular risk score (0-100). This is a transparent,
 * additive heuristic — NOT a validated risk equation and NOT an ASCVD percentage.
 * Missing inputs simply don't contribute (and are reported back).
 */
export function computeCardioRisk(input: CardioInput): CardioRisk {
  const drivers: { text: string; weight: number }[] = [];
  const missing: string[] = [];
  let score = 0;

  // Age: gentle ramp from ~40 upward.
  if (input.age != null && Number.isFinite(input.age)) {
    const ageContrib = clamp((input.age - 40) * 0.8, 0, 30);
    score += ageContrib;
    if (ageContrib >= 12) drivers.push({ text: `Age ${Math.round(input.age)}`, weight: ageContrib });
  } else {
    missing.push("date of birth");
  }

  // Sex (a small, fixed offset; illustrative only).
  if (input.sex === "male") score += 6;
  else if (input.sex == null) missing.push("sex");

  // Systolic blood pressure.
  if (input.systolic != null && Number.isFinite(input.systolic)) {
    const bpContrib = clamp((input.systolic - 115) * 0.6, 0, 26);
    score += bpContrib;
    if (bpContrib >= 8) drivers.push({ text: `Systolic ${Math.round(input.systolic)} mmHg`, weight: bpContrib });
  } else {
    missing.push("blood pressure");
  }

  // Total cholesterol.
  if (input.totalChol != null && Number.isFinite(input.totalChol)) {
    const tcContrib = clamp((input.totalChol - 170) * 0.18, 0, 18);
    score += tcContrib;
    if (tcContrib >= 6) drivers.push({ text: `Total cholesterol ${Math.round(input.totalChol)} mg/dL`, weight: tcContrib });
  } else {
    missing.push("total cholesterol");
  }

  // HDL (protective — higher reduces the score).
  if (input.hdl != null && Number.isFinite(input.hdl)) {
    const hdlContrib = clamp((55 - input.hdl) * 0.3, -10, 14);
    score += hdlContrib;
    if (hdlContrib >= 6) drivers.push({ text: `Low HDL ${Math.round(input.hdl)} mg/dL`, weight: hdlContrib });
  } else {
    missing.push("HDL cholesterol");
  }

  score = Math.round(clamp(score, 0, 100));
  const { band, label } = bandFor(score);
  drivers.sort((a, b) => b.weight - a.weight);

  return {
    score,
    band,
    label,
    drivers: drivers.map((d) => d.text),
    missing,
  };
}

/**
 * PURE. Places each available metric within its (rough) reference distribution
 * and returns an illustrative percentile (0-100). `metricsLatest` is the shape
 * returned by getLatestByMetric: { [code]: { value } }.
 */
export function computePercentiles(
  metricsLatest: Record<string, { value: number }>,
): PercentileRow[] {
  const out: PercentileRow[] = [];
  for (const key of Object.keys(REFERENCE)) {
    const ref = REFERENCE[key];
    const latest = metricsLatest[key];
    if (!latest || !Number.isFinite(latest.value)) continue;
    const z = (latest.value - ref.mean) / ref.sd;
    const percentile = Math.round(clamp(normalCdf(z) * 100, 1, 99));
    out.push({
      key,
      display: ref.display,
      value: latest.value,
      unit: ref.unit,
      percentile,
      higherIsBetter: ref.higherIsBetter,
      note: ref.note,
    });
  }
  return out;
}

// ---- gather ----------------------------------------------------------------

function ageFromDob(dob: string | null): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function normalizeSex(raw: string | null): "male" | "female" | null {
  if (!raw) return null;
  const s = raw.trim().toLowerCase();
  if (s.startsWith("m")) return "male";
  if (s.startsWith("f")) return "female";
  return null;
}

const TOTAL_CHOL_CODES = ["chol-total", "total-cholesterol", "cholesterol-total", "cholesterol"];
const HDL_CODES = ["hdl", "hdl-cholesterol", "hdl-c"];

function biomarkerValue(
  biomarkers: { code: string; display: string; latest: number }[],
  codes: string[],
  displayMatch: RegExp,
): number | null {
  for (const code of codes) {
    const hit = biomarkers.find((b) => b.code === code);
    if (hit && Number.isFinite(hit.latest)) return hit.latest;
  }
  const byDisplay = biomarkers.find((b) => displayMatch.test(b.display) && Number.isFinite(b.latest));
  return byDisplay ? byDisplay.latest : null;
}

const METHODOLOGY: string[] = [
  "Your inputs are read from your own data: age (from your date of birth), sex, latest blood pressure, and the most recent cholesterol values from your labs.",
  "The illustrative cardiovascular band is a simple, transparent point total — each input nudges the score up or down by a fixed amount. It is NOT a validated risk equation and is NOT an ASCVD percentage.",
  "Percentiles place each tracked metric loosely within a rough population spread (a fixed mean and standard deviation per metric). These reference values are approximate and for illustration only.",
  "Where higher is generally considered better (HRV, VO₂ max) a higher percentile is shaded favorably; where lower is generally preferable (resting heart rate, fasting glucose) the shading is inverted.",
  "Nothing here is personalized medical advice. A real estimate of cardiovascular or biological age requires a clinician, validated tools, and context this view does not have.",
];

/**
 * Ownership-scoped gather: age + sex + latest metrics + cholesterol biomarkers,
 * returning the illustrative cardio band, percentiles, and methodology copy.
 */
export async function getLongevity(userId: string): Promise<Longevity> {
  const [user, latest, biomarkers] = await Promise.all([
    getUserScoped(userId),
    getLatestByMetric(userId),
    getBiomarkers(userId),
  ]);

  const age = ageFromDob(user?.dob ?? null);
  const sex = normalizeSex(user?.sexAssigned ?? null);
  const systolic = latest["bp_systolic"]?.value ?? null;
  const totalChol = biomarkerValue(biomarkers, TOTAL_CHOL_CODES, /total\s*chol|cholesterol,?\s*total/i);
  const hdl = biomarkerValue(biomarkers, HDL_CODES, /hdl/i);

  const cardio = computeCardioRisk({ age, sex, systolic, totalChol, hdl });
  const percentiles = computePercentiles(latest);

  const hasData =
    age != null || systolic != null || totalChol != null || hdl != null || percentiles.length > 0;

  await logAction(userId, "longevity.view", {
    band: cardio.band,
    percentileCount: percentiles.length,
  });

  return { cardio, percentiles, methodology: METHODOLOGY, hasData };
}

/** Local ownership-scoped user fetch (mirrors account.getUser without importing it). */
async function getUserScoped(userId: string): Promise<User | undefined> {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  return user;
}
