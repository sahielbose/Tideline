/**
 * Saved report snapshots (route /app/reports). A snapshot captures a compact,
 * point-in-time copy of the user's headline health index, illustrative risk
 * bands, and latest metric readings so they can be revisited later.
 *
 * SAFETY: every captured score is illustrative — not a clinical or diagnostic
 * measurement. Nothing here diagnoses, prescribes, or replaces a provider.
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { reportSnapshots, type ReportSnapshot } from "../db/schema";
import { getHealthIndex } from "./health-index";
import { getRiskPanel } from "./risk";
import { getLatestByMetric } from "./metrics";
import { logAction } from "./audit";

/** Compact, serializable shape persisted in `reportSnapshots.data`. */
export interface SnapshotData {
  capturedAt: string;
  healthIndex: {
    index: number;
    label: string;
    healthAge: number | null;
    available: number;
    note: string;
  };
  risk: {
    metabolicSyndrome: { criteriaMet: number; total: number; meets: boolean };
    cardiometabolic: { band: "favorable" | "watch" | "elevated"; outOfOptimal: number; drivers: string[] };
    note: string;
  };
  metrics: { code: string; value: number; unit: string | null; at: string }[];
  disclaimer: string;
}

const DISCLAIMER =
  "Illustrative — not a clinical or diagnostic measurement. This snapshot does not diagnose or prescribe and is not a substitute for a licensed provider.";

/**
 * Pure builder: assemble the compact snapshot object from the gathered inputs.
 * Kept separate from persistence so the computation is testable and side-free.
 */
export function buildSnapshotData(input: {
  healthIndex: Awaited<ReturnType<typeof getHealthIndex>>;
  risk: Awaited<ReturnType<typeof getRiskPanel>>;
  latest: Awaited<ReturnType<typeof getLatestByMetric>>;
}): SnapshotData {
  const { healthIndex, risk, latest } = input;
  const metrics = Object.entries(latest).map(([code, l]) => ({
    code,
    value: l.value,
    unit: l.unit,
    at: l.at,
  }));
  return {
    capturedAt: new Date().toISOString(),
    healthIndex: {
      index: healthIndex.index,
      label: healthIndex.label,
      healthAge: healthIndex.healthAge,
      available: healthIndex.available,
      note: healthIndex.note,
    },
    risk: {
      metabolicSyndrome: {
        criteriaMet: risk.metabolicSyndrome.criteriaMet,
        total: risk.metabolicSyndrome.total,
        meets: risk.metabolicSyndrome.meets,
      },
      cardiometabolic: {
        band: risk.cardiometabolic.band,
        outOfOptimal: risk.cardiometabolic.outOfOptimal,
        drivers: risk.cardiometabolic.drivers,
      },
      note: risk.cardiometabolic.note,
    },
    metrics,
    disclaimer: DISCLAIMER,
  };
}

/** Capture the current health index + risk + latest metrics into a new snapshot. */
export async function saveSnapshot(userId: string): Promise<ReportSnapshot> {
  const [healthIndex, risk, latest] = await Promise.all([
    getHealthIndex(userId),
    getRiskPanel(userId),
    getLatestByMetric(userId),
  ]);
  const data = buildSnapshotData({ healthIndex, risk, latest });
  const label = `Snapshot ${new Date().toLocaleDateString()}`;
  const [row] = await db
    .insert(reportSnapshots)
    .values({ userId, label, data: data as unknown as Record<string, unknown> })
    .returning();
  await logAction(userId, "report.snapshot", { snapshotId: row.id, index: healthIndex.index });
  return row;
}

export async function listSnapshots(userId: string): Promise<ReportSnapshot[]> {
  return db
    .select()
    .from(reportSnapshots)
    .where(eq(reportSnapshots.userId, userId))
    .orderBy(desc(reportSnapshots.createdAt));
}

/** Ownership-scoped: returns the snapshot only if it belongs to `userId`. */
export async function getSnapshot(userId: string, id: string): Promise<ReportSnapshot | undefined> {
  const [row] = await db
    .select()
    .from(reportSnapshots)
    .where(and(eq(reportSnapshots.id, id), eq(reportSnapshots.userId, userId)));
  return row;
}
