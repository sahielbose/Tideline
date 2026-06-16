/**
 * Illustrative risk indicators (market parity: longevity risk panels). These are
 * TRANSPARENT screening-style summaries, clearly labeled illustrative and
 * non-diagnostic — no fabricated probabilities (no-fabrication rule).
 */
import { getLatestByMetric } from "./metrics";
import { getBiomarkers } from "./labs";
import { getUser } from "./account";

export interface MetSynCriterion {
  name: string;
  met: boolean;
  detail: string;
}

export interface RiskPanel {
  metabolicSyndrome: {
    criteriaMet: number;
    total: number;
    meets: boolean;
    criteria: MetSynCriterion[];
    note: string;
  };
  cardiometabolic: {
    band: "favorable" | "watch" | "elevated";
    outOfOptimal: number;
    drivers: string[];
    note: string;
  };
}

export interface RiskInput {
  glucose?: number;
  systolic?: number;
  diastolic?: number;
  trig?: number;
  hdl?: number;
  a1c?: number;
  ldl?: number;
  sex?: string | null;
}

export function computeRisk(i: RiskInput): RiskPanel {
  const hdlThreshold = i.sex === "female" ? 50 : 40;
  const criteria: MetSynCriterion[] = [
    { name: "Fasting glucose ≥ 100 mg/dL", met: (i.glucose ?? 0) >= 100, detail: i.glucose != null ? `${i.glucose} mg/dL` : "no reading" },
    { name: "Blood pressure ≥ 130/85 mmHg", met: (i.systolic ?? 0) >= 130 || (i.diastolic ?? 0) >= 85, detail: i.systolic != null ? `${i.systolic}/${i.diastolic ?? "?"} mmHg` : "no reading" },
    { name: "Triglycerides ≥ 150 mg/dL", met: (i.trig ?? 0) >= 150, detail: i.trig != null ? `${i.trig} mg/dL` : "no reading" },
    { name: `HDL < ${hdlThreshold} mg/dL`, met: i.hdl != null && i.hdl < hdlThreshold, detail: i.hdl != null ? `${i.hdl} mg/dL` : "no reading" },
  ];
  const criteriaMet = criteria.filter((c) => c.met).length;

  const drivers: string[] = [];
  if ((i.glucose ?? 0) > 90) drivers.push("fasting glucose above optimal");
  if ((i.a1c ?? 0) > 5.4) drivers.push("HbA1c above optimal");
  if ((i.ldl ?? 0) > 100) drivers.push("LDL above optimal");
  if ((i.trig ?? 0) > 100) drivers.push("triglycerides above optimal");
  if (i.hdl != null && i.hdl < 60) drivers.push("HDL below optimal");
  if ((i.systolic ?? 0) > 120 || (i.diastolic ?? 0) > 80) drivers.push("blood pressure above optimal");
  const outOfOptimal = drivers.length;
  const band = outOfOptimal >= 4 ? "elevated" : outOfOptimal >= 2 ? "watch" : "favorable";

  return {
    metabolicSyndrome: {
      criteriaMet,
      total: criteria.length,
      meets: criteriaMet >= 3,
      criteria,
      note: "A simplified screening count (waist circumference is not tracked). Meeting 3+ is a recognized screening threshold, not a diagnosis.",
    },
    cardiometabolic: {
      band,
      outOfOptimal,
      drivers,
      note: "An illustrative count of cardiometabolic markers outside their optimal range — not a validated 10-year risk score.",
    },
  };
}

export async function getRiskPanel(userId: string): Promise<RiskPanel> {
  const [latest, markers, user] = await Promise.all([
    getLatestByMetric(userId),
    getBiomarkers(userId),
    getUser(userId),
  ]);
  const marker = (code: string) => markers.find((m) => m.code === code)?.latest;
  return computeRisk({
    glucose: latest["glucose"]?.value ?? marker("glucose-fasting"),
    systolic: latest["bp_systolic"]?.value,
    diastolic: latest["bp_diastolic"]?.value,
    trig: marker("trig"),
    hdl: marker("hdl"),
    a1c: marker("hba1c"),
    ldl: marker("ldl"),
    sex: user?.sexAssigned ?? null,
  });
}
