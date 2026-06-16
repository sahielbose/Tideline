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
import { parseLabFile, parseFhirBundle, parseWearableFile } from "./file";

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

// ---- file-import implementations (records + wearables) -------------------
// The uploaded content is captured in the connection config at connect-time so
// a later re-sync re-parses the same source deterministically.
class FileRecordsAdapter implements RecordsAdapter {
  async connect(_userId: string, cfg: Record<string, unknown> = {}): Promise<ConnectDescriptor> {
    const filename = String(cfg.filename ?? "records.json");
    return {
      kind: "records",
      adapter: "file",
      label: `Records — ${filename}`,
      status: "connected",
      config: { filename, content: String(cfg.content ?? "") },
    };
  }
  async fetch(conn: ConnectDescriptor): Promise<RawRecord[]> {
    const content = String((conn.config as Record<string, unknown>).content ?? "");
    return content ? parseFhirBundle(content) : [];
  }
}

class FileBiometricsAdapter implements BiometricsAdapter {
  async connect(_userId: string, cfg: Record<string, unknown> = {}): Promise<ConnectDescriptor> {
    const filename = String(cfg.filename ?? "wearable.csv");
    return {
      kind: "wearable",
      adapter: "file",
      label: `Wearable — ${filename}`,
      status: "connected",
      config: { filename, content: String(cfg.content ?? "") },
    };
  }
  async fetch(conn: ConnectDescriptor): Promise<RawMetricPoint[]> {
    const cfg = conn.config as Record<string, unknown>;
    const content = String(cfg.content ?? "");
    return content ? parseWearableFile(String(cfg.filename ?? "wearable.csv"), content) : [];
  }
}

// Sandbox adapters are key-gated (Phase 2+). Without keys they fail loudly
// instead of silently returning nothing.
class SandboxRecordsAdapter implements RecordsAdapter {
  async connect(): Promise<ConnectDescriptor> {
    throw new Error("Records sandbox is not configured. Set RECORDS_SANDBOX_KEY, or use the mock adapter / FHIR file import.");
  }
  async fetch(): Promise<RawRecord[]> {
    return [];
  }
}
class SandboxBiometricsAdapter implements BiometricsAdapter {
  async connect(): Promise<ConnectDescriptor> {
    throw new Error("Wearables sandbox is not configured. Set WEARABLES_SANDBOX_KEY, or use the mock adapter / file import.");
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
      return new FileRecordsAdapter();
    case "sandbox":
      return new SandboxRecordsAdapter();
  }
}

export function getBiometricsAdapter(adapter: AdapterKind = config.dataAdapterDefault): BiometricsAdapter {
  switch (adapter) {
    case "mock":
      return new MockBiometricsAdapter();
    case "file":
      return new FileBiometricsAdapter();
    case "sandbox":
      return new SandboxBiometricsAdapter();
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
export { parseFhirBundle, parseWearableFile, parseLabFile } from "./file";
