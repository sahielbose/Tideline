/**
 * Preventive-care / screening "care gaps" (market parity: tech primary care).
 * A deterministic rule table diffed against the user's age/sex + last test dates.
 * Framing is "commonly recommended — discuss with a clinician"; it never orders
 * a test or implies a diagnosis (spec-safe).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { labs, labMarkers, observations } from "../db/schema";
import { getUser } from "./account";

interface Screening {
  key: string;
  name: string;
  minAge: number;
  maxAge?: number;
  sex?: "male" | "female";
  intervalMonths: number;
  basis: string;
}

const SCREENINGS: Screening[] = [
  { key: "bp", name: "Blood pressure check", minAge: 18, intervalMonths: 12, basis: "vitals" },
  { key: "lipid", name: "Cholesterol / lipid panel", minAge: 20, intervalMonths: 60, basis: "lab:ldl" },
  { key: "glucose", name: "Blood glucose / HbA1c", minAge: 35, intervalMonths: 36, basis: "lab:hba1c" },
  { key: "colorectal", name: "Colorectal cancer screening", minAge: 45, maxAge: 75, intervalMonths: 120, basis: "none" },
  { key: "cervical", name: "Cervical cancer screening", sex: "female", minAge: 21, maxAge: 65, intervalMonths: 36, basis: "none" },
  { key: "mammogram", name: "Mammogram", sex: "female", minAge: 40, intervalMonths: 24, basis: "none" },
  { key: "prostate", name: "Prostate (PSA) discussion", sex: "male", minAge: 50, intervalMonths: 24, basis: "none" },
];

export type CareGapStatus = "due" | "overdue" | "ok";

export interface CareGap {
  key: string;
  name: string;
  status: CareGapStatus;
  detail: string;
}

export interface CareGapsInput {
  age: number | null;
  sex: string | null;
  lastDates: Record<string, Date | null>;
  now?: Date;
}

const MONTH = 30.44 * 86_400_000;

export function computeCareGaps(input: CareGapsInput): CareGap[] {
  const now = input.now ?? new Date();
  if (input.age == null) return [];
  const out: CareGap[] = [];
  for (const s of SCREENINGS) {
    if (input.age < s.minAge || (s.maxAge != null && input.age > s.maxAge)) continue;
    if (s.sex && input.sex && s.sex !== input.sex) continue;
    if (s.sex && !input.sex) continue;
    const last = input.lastDates[s.key] ?? null;
    if (!last) {
      out.push({ key: s.key, name: s.name, status: "due", detail: "No record on file." });
      continue;
    }
    const monthsSince = (now.getTime() - last.getTime()) / MONTH;
    if (monthsSince > s.intervalMonths) {
      out.push({ key: s.key, name: s.name, status: "overdue", detail: `Last ~${Math.round(monthsSince)} mo ago (every ${s.intervalMonths} mo).` });
    } else {
      const dueIn = Math.round(s.intervalMonths - monthsSince);
      out.push({ key: s.key, name: s.name, status: "ok", detail: `Up to date — next in ~${dueIn} mo.` });
    }
  }
  const order: Record<CareGapStatus, number> = { overdue: 0, due: 1, ok: 2 };
  return out.sort((a, b) => order[a.status] - order[b.status]);
}

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) age--;
  return age;
}

async function lastLabByMarker(userId: string, code: string): Promise<Date | null> {
  const [row] = await db
    .select({ at: labs.collectedAt })
    .from(labMarkers)
    .innerJoin(labs, eq(labMarkers.labId, labs.id))
    .where(and(eq(labs.userId, userId), eq(labMarkers.code, code)))
    .orderBy(desc(labs.collectedAt))
    .limit(1);
  return row?.at ?? null;
}

export async function getCareGaps(userId: string): Promise<CareGap[]> {
  const user = await getUser(userId);
  const [bp] = await db
    .select({ at: observations.effectiveAt })
    .from(observations)
    .where(and(eq(observations.userId, userId), eq(observations.code, "bp_systolic")))
    .orderBy(desc(observations.effectiveAt))
    .limit(1);
  const lastDates: Record<string, Date | null> = {
    bp: bp?.at ?? null,
    lipid: await lastLabByMarker(userId, "ldl"),
    glucose: await lastLabByMarker(userId, "hba1c"),
  };
  return computeCareGaps({ age: ageFromDob(user?.dob), sex: user?.sexAssigned ?? null, lastDates });
}
