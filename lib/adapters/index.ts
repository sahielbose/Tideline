/**
 * The adapter seam (CONTEXT.md §7). Every external data source goes behind one
 * of these interfaces with three implementations — mock, file, sandbox.
 * Routes/components NEVER call a vendor SDK directly; they call services, which
 * call adapters selected here by config.
 */
import type {
  AdapterKind,
  ConnectionKind,
  RawRecord,
  RawMetricPoint,
  RawLabPanel,
} from "../types";
import { config } from "../config";
import {
  buildBiometricPoints,
  generateRecords,
  generateLabPanels,
} from "./mock";
import { parseLabFile } from "./file";

export interface ConnectDescriptor {
  kind: ConnectionKind;
  adapter: AdapterKind;
  label: string;
  status: string;
  config: Record<string, unknown>;
}

export interface RecordsAdapter {
  connect(userId: string, cfg?: Record<string, unknown>): Promise<ConnectDescriptor>;
  fetch(conn: ConnectDescriptor, sinceISO?: string): Promise<RawRecord[]>;
}

export interface BiometricsAdapter {
  connect(userId: string, cfg?: Record<string, unknown>): Promise<ConnectDescriptor>;
  fetch(conn: ConnectDescriptor, sinceISO?: string): Promise<RawMetricPoint[]>;
}

export type LabIngestInput =
  | { kind: "mock" }
  | { kind: "file"; filename: string; content: string };

export interface LabsAdapter {
  ingest(input: LabIngestInput): Promise<RawLabPanel[]>;
}

// ---- mock implementations -------------------------------------------------
class MockRecordsAdapter implements RecordsAdapter {
  async connect(): Promise<ConnectDescriptor> {
    return {
      kind: "records",
      adapter: "mock",
      label: "Medical records (demo)",
      status: "connected",
      config: { organizations: ["Acme Health", "Optum", "St Luke's"] },
    };
  }
  async fetch(): Promise<RawRecord[]> {
    return generateRecords(new Date());
  }
}

class MockBiometricsAdapter implements BiometricsAdapter {
  async connect(): Promise<ConnectDescriptor> {
    return {
      kind: "wearable",
      adapter: "mock",
      label: "Oura (demo)",
      status: "connected",
      config: { device: "Oura" },
    };
  }
  async fetch(): Promise<RawMetricPoint[]> {
    return buildBiometricPoints(new Date());
  }
}

class MockLabsAdapter implements LabsAdapter {
  async ingest(): Promise<RawLabPanel[]> {
    return generateLabPanels(new Date());
  }
}

// ---- file-import implementations -----------------------------------------
class FileLabsAdapter implements LabsAdapter {
  async ingest(input: LabIngestInput): Promise<RawLabPanel[]> {
    if (input.kind !== "file") return [];
    return parseLabFile(input.filename, input.content);
  }
}

// Phase 2 placeholders: file/sandbox records + wearables import. They throw a
// clear, actionable error rather than silently doing nothing.
class NotImplementedRecords implements RecordsAdapter {
  constructor(private readonly which: string) {}
  async connect(): Promise<ConnectDescriptor> {
    throw new Error(`${this.which} records adapter is not configured (Phase 2). Use the mock adapter or load demo data.`);
  }
  async fetch(): Promise<RawRecord[]> {
    return [];
  }
}
class NotImplementedBiometrics implements BiometricsAdapter {
  constructor(private readonly which: string) {}
  async connect(): Promise<ConnectDescriptor> {
    throw new Error(`${this.which} wearable adapter is not configured (Phase 2). Use the mock adapter or load demo data.`);
  }
  async fetch(): Promise<RawMetricPoint[]> {
    return [];
  }
}

// ---- selectors ------------------------------------------------------------
export function getRecordsAdapter(adapter: AdapterKind = config.dataAdapterDefault): RecordsAdapter {
  switch (adapter) {
    case "mock":
      return new MockRecordsAdapter();
    case "file":
      return new NotImplementedRecords("file");
    case "sandbox":
      return new NotImplementedRecords("sandbox");
  }
}

export function getBiometricsAdapter(adapter: AdapterKind = config.dataAdapterDefault): BiometricsAdapter {
  switch (adapter) {
    case "mock":
      return new MockBiometricsAdapter();
    case "file":
      return new NotImplementedBiometrics("file");
    case "sandbox":
      return new NotImplementedBiometrics("sandbox");
  }
}

export function getLabsAdapter(adapter: AdapterKind = config.dataAdapterDefault): LabsAdapter {
  switch (adapter) {
    case "file":
      return new FileLabsAdapter();
    case "sandbox":
    case "mock":
    default:
      return new MockLabsAdapter();
  }
}

export { buildBiometricPoints, generateRecords, generateLabPanels } from "./mock";
