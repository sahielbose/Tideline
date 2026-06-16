/**
 * Ingestion services (CONTEXT.md §7, §12). Everything funnels through adapters
 * and normalizes into the observations spine. connectSource/syncConnection run
 * the fetch + store + recompute + sweep pipeline; the Inngest jobs wrap these
 * for durability, but they also work inline so the app is usable without the
 * jobs runner.
 */
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { connections, observations, type Connection } from "../db/schema";
import {
  getRecordsAdapter,
  getBiometricsAdapter,
} from "../adapters";
import type {
  AdapterKind,
  ConnectionKind,
  RawRecord,
  RawMetricPoint,
} from "../types";
import { METRICS } from "../metrics";
import { recomputeBaselines } from "./metrics";
import { logAction } from "./audit";

interface StoredObs {
  category: RawRecord["category"];
  code: string;
  display: string;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: string | null;
  effectiveAt: string;
  raw?: unknown;
}

export async function storeObservations(
  userId: string,
  rows: StoredObs[],
  connectionId?: string,
): Promise<number> {
  if (!rows.length) return 0;
  await db.insert(observations).values(
    rows.map((r) => ({
      userId,
      category: r.category,
      code: r.code,
      display: r.display,
      valueNum: r.valueNum ?? null,
      valueText: r.valueText ?? null,
      unit: r.unit ?? null,
      effectiveAt: new Date(r.effectiveAt),
      sourceConnectionId: connectionId ?? null,
      raw: r.raw ?? null,
    })),
  );
  return rows.length;
}

export function metricPointsToObs(points: RawMetricPoint[]): StoredObs[] {
  return points.map((p) => ({
    category: p.category ?? METRICS[p.code]?.category ?? "wearable",
    code: p.code,
    display: p.display,
    valueNum: p.value,
    unit: p.unit,
    effectiveAt: p.effectiveAt,
  }));
}

export function recordsToObs(records: RawRecord[]): StoredObs[] {
  return records.map((r) => ({
    category: r.category,
    code: r.code,
    display: r.display,
    valueNum: r.value ?? null,
    valueText: r.valueText ?? null,
    unit: r.unit ?? null,
    effectiveAt: r.effectiveAt,
    raw: r.raw,
  }));
}

export async function connectSource(
  userId: string,
  kind: ConnectionKind,
  adapter: AdapterKind,
  cfg: Record<string, unknown> = {},
): Promise<Connection> {
  const descriptor =
    kind === "records"
      ? await getRecordsAdapter(adapter).connect(userId, cfg)
      : await getBiometricsAdapter(adapter).connect(userId, cfg);

  const [conn] = await db
    .insert(connections)
    .values({
      userId,
      kind: descriptor.kind,
      adapter: descriptor.adapter,
      status: descriptor.status,
      label: descriptor.label,
      config: descriptor.config,
    })
    .returning();
  await logAction(userId, "connection.connect", { kind, adapter, connectionId: conn.id });
  await syncConnection(conn.id);
  return conn;
}

export async function syncConnection(connectionId: string): Promise<number> {
  const [conn] = await db.select().from(connections).where(eq(connections.id, connectionId));
  if (!conn) throw new Error("Connection not found");

  let count = 0;
  if (conn.kind === "records") {
    const records = await getRecordsAdapter(conn.adapter).fetch({
      kind: conn.kind,
      adapter: conn.adapter,
      label: conn.label,
      status: conn.status,
      config: conn.config,
    });
    count = await storeObservations(conn.userId, recordsToObs(records), conn.id);
  } else if (conn.kind === "wearable") {
    const points = await getBiometricsAdapter(conn.adapter).fetch({
      kind: conn.kind,
      adapter: conn.adapter,
      label: conn.label,
      status: conn.status,
      config: conn.config,
    });
    count = await storeObservations(conn.userId, metricPointsToObs(points), conn.id);
  }

  await db
    .update(connections)
    .set({ status: "connected", lastSyncedAt: new Date() })
    .where(eq(connections.id, connectionId));
  await recomputeBaselines(conn.userId);
  await logAction(conn.userId, "connection.sync", { connectionId, count });
  return count;
}

export async function listConnections(userId: string): Promise<Connection[]> {
  return db.select().from(connections).where(eq(connections.userId, userId));
}
