/**
 * Shared domain types for Tideline.
 * These are the contract between the adapters, the drift engine, the AI layer,
 * the services, and the UI. Keep them stable (see CONTEXT.md §20: one-way doors).
 */

// ---- severity & status ----------------------------------------------------
export type Severity = "info" | "watch" | "elevated" | "urgent";

/** Status shown on a dashboard metric card. */
export type MetricStatus = "normal" | "info" | "watch" | "elevated" | "urgent";

/** CSS class suffix used by the ported design system (globals.css). */
export const STATUS_CLASS: Record<MetricStatus, string> = {
  normal: "ok",
  info: "info",
  watch: "watch",
  elevated: "elev",
  urgent: "urgent",
};

export const STATUS_LABEL: Record<MetricStatus, string> = {
  normal: "Normal",
  info: "Info",
  watch: "Watch",
  elevated: "Elevated",
  urgent: "Urgent",
};

export const SEVERITY_RANK: Record<Severity, number> = {
  info: 1,
  watch: 2,
  elevated: 3,
  urgent: 4,
};

// ---- triage ---------------------------------------------------------------
export type TriageBand =
  | "self-care"
  | "clinician-soon"
  | "urgent"
  | "emergency"
  | "gathering";

export const TRIAGE_LABEL: Record<TriageBand, string> = {
  "self-care": "Self-care",
  "clinician-soon": "See a clinician soon",
  urgent: "Urgent: same-day care",
  emergency: "Emergency",
  gathering: "Gathering details",
};

/** Maps a triage band to a status chip class for the chat UI. */
export const TRIAGE_STATUS_CLASS: Record<TriageBand, string> = {
  "self-care": "info",
  "clinician-soon": "watch",
  urgent: "elev",
  emergency: "urgent",
  gathering: "info",
};

// ---- drift ----------------------------------------------------------------
export type DriftType = "trend" | "reference-cross" | "anomaly" | "cross-signal";

export interface DriftEvidence {
  baselineCenter: number | null;
  baselineSpread: number | null;
  latest: number;
  refLow?: number | null;
  refHigh?: number | null;
  slopePerWeek?: number;
  zScore?: number;
  nReadings: number;
  summary: string;
  contributing?: string[];
}

export interface DriftSignal {
  metric: string;
  metrics?: string[];
  type: DriftType;
  severity: Severity;
  /** Signed magnitude in metric units (or z for anomalies). */
  magnitude: number;
  direction: "up" | "down" | "flat";
  windowStart: string;
  windowEnd: string;
  evidence: DriftEvidence;
}

export interface MetricSeriesPoint {
  t: string; // ISO timestamp
  v: number;
}

// ---- red-flag classifier --------------------------------------------------
export type RedFlagCategory =
  | "cardiac"
  | "neurological"
  | "respiratory"
  | "self-harm"
  | "bleeding"
  | "other"
  | "none";

export interface RedFlagVerdict {
  emergency: boolean;
  category: RedFlagCategory;
  confidence: number; // 0..1
  /** True for self-harm / suicidal ideation: crisis resources lead. */
  crisis: boolean;
  matched?: string[];
}

// ---- chat -----------------------------------------------------------------
export type ChatRole = "user" | "assistant" | "system";

export interface ChatTurn {
  role: ChatRole;
  content: string;
}

export interface AgentReply {
  content: string;
  triage: TriageBand;
}

// ---- adapter raw shapes ---------------------------------------------------
export type ObservationCategory =
  | "vital"
  | "lab"
  | "wearable"
  | "condition"
  | "encounter"
  | "medication_event";

export type ConnectionKind = "records" | "wearable" | "lab";
export type AdapterKind = "sandbox" | "file" | "mock";

export type InsightStatusType = "new" | "acknowledged" | "flagged" | "resolved";
export type ReviewStatusType = "open" | "in_review" | "resolved";

export interface RawMetricPoint {
  code: string;
  display: string;
  value: number;
  unit: string;
  effectiveAt: string;
  category?: ObservationCategory;
}

export interface RawRecord {
  category: ObservationCategory;
  code: string;
  display: string;
  value?: number;
  valueText?: string;
  unit?: string;
  effectiveAt: string;
  raw?: unknown;
}

export interface RawLabMarker {
  code: string;
  display: string;
  value: number;
  unit: string;
  refLow?: number;
  refHigh?: number;
}

export interface RawLabPanel {
  panelName: string;
  collectedAt: string;
  markers: RawLabMarker[];
}

/** A normalized observation ready to write to the observations table. */
export interface NormalizedObservation {
  category: ObservationCategory;
  code: string;
  display: string;
  valueNum?: number | null;
  valueText?: string | null;
  unit?: string | null;
  effectiveAt: string;
  raw?: unknown;
}

export interface Connection {
  id: string;
  userId: string;
  kind: ConnectionKind;
  adapter: AdapterKind;
  status: string;
  label: string;
  config: Record<string, unknown>;
}
