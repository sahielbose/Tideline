import {
  pgTable,
  uuid,
  text,
  doublePrecision,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import type {
  ObservationCategory,
  ConnectionKind,
  AdapterKind,
  Severity,
  InsightStatusType,
  ReviewStatusType,
  ChatRole,
  RedFlagVerdict,
  TriageBand,
} from "../types";

// `InsightStatusType`/`ReviewStatusType` are declared here to keep the schema
// self-describing; re-exported from types for convenience.
export type { InsightStatusType, ReviewStatusType };

// ---------------------------------------------------------------------------
// users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  dob: date("dob"),
  sexAssigned: text("sex_assigned"),
  unitsPref: text("units_pref").notNull().default("imperial"),
  notifyOptIn: boolean("notify_opt_in").notNull().default(false),
  notifyEmail: text("notify_email"),
  // Structured health profile: conditions, allergies, familyHistory, goals, height, etc.
  profile: jsonb("profile").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// connections — a data source (records | wearable | lab)
// ---------------------------------------------------------------------------
export const connections = pgTable("connections", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").$type<ConnectionKind>().notNull(),
  adapter: text("adapter").$type<AdapterKind>().notNull(),
  status: text("status").notNull().default("connected"),
  label: text("label").notNull(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// observations — the normalized spine of the timeline & drift engine
// ---------------------------------------------------------------------------
export const observations = pgTable(
  "observations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: text("category").$type<ObservationCategory>().notNull(),
    code: text("code").notNull(),
    display: text("display").notNull(),
    valueNum: doublePrecision("value_num"),
    valueText: text("value_text"),
    unit: text("unit"),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    sourceConnectionId: uuid("source_connection_id").references(() => connections.id, {
      onDelete: "set null",
    }),
    raw: jsonb("raw"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byUserCode: index("obs_user_code_at_idx").on(t.userId, t.code, t.effectiveAt),
    byUserCat: index("obs_user_cat_at_idx").on(t.userId, t.category, t.effectiveAt),
  }),
);

// ---------------------------------------------------------------------------
// metric_baselines — per user per metric
// ---------------------------------------------------------------------------
export const metricBaselines = pgTable("metric_baselines", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  center: doublePrecision("center").notNull(),
  spread: doublePrecision("spread").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  n: integer("n").notNull(),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  active: boolean("active").notNull().default(false),
});

// ---------------------------------------------------------------------------
// reference_ranges — population ranges (seeded, configurable)
// ---------------------------------------------------------------------------
export const referenceRanges = pgTable("reference_ranges", {
  id: uuid("id").defaultRandom().primaryKey(),
  metric: text("metric").notNull().unique(),
  low: doublePrecision("low"),
  high: doublePrecision("high"),
  optimalLow: doublePrecision("optimal_low"),
  optimalHigh: doublePrecision("optimal_high"),
  unit: text("unit"),
  context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
});

// ---------------------------------------------------------------------------
// drift_signals — raw engine output
// ---------------------------------------------------------------------------
export const driftSignals = pgTable("drift_signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  metric: text("metric").notNull(),
  type: text("type").notNull(),
  severity: text("severity").$type<Severity>().notNull(),
  magnitude: doublePrecision("magnitude").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  evidence: jsonb("evidence").notNull(),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// insights — explained, user-facing signals
// ---------------------------------------------------------------------------
export const insights = pgTable("insights", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  driftSignalId: uuid("drift_signal_id").references(() => driftSignals.id, {
    onDelete: "set null",
  }),
  metric: text("metric"),
  title: text("title").notNull(),
  severity: text("severity").$type<Severity>().notNull(),
  explanationMd: text("explanation_md").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  status: text("status").$type<InsightStatusType>().notNull().default("new"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// review_flags — the mocked clinician-in-the-loop queue
// ---------------------------------------------------------------------------
export const reviewFlags = pgTable("review_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  source: text("source").notNull(),
  context: jsonb("context").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").$type<ReviewStatusType>().notNull().default("open"),
  reviewerNoteMd: text("reviewer_note_md"),
  simulated: boolean("simulated").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// labs & lab_markers
// ---------------------------------------------------------------------------
export const labs = pgTable("labs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  panelName: text("panel_name").notNull(),
  collectedAt: timestamp("collected_at", { withTimezone: true }).notNull(),
  sourceConnectionId: uuid("source_connection_id").references(() => connections.id, {
    onDelete: "set null",
  }),
  explanationMd: text("explanation_md"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const labMarkers = pgTable("lab_markers", {
  id: uuid("id").defaultRandom().primaryKey(),
  labId: uuid("lab_id").notNull().references(() => labs.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  display: text("display").notNull(),
  value: doublePrecision("value"),
  valueText: text("value_text"),
  unit: text("unit"),
  refLow: doublePrecision("ref_low"),
  refHigh: doublePrecision("ref_high"),
  // Optimal / longevity band (tighter than the standard reference range).
  optimalLow: doublePrecision("optimal_low"),
  optimalHigh: doublePrecision("optimal_high"),
  flag: text("flag").notNull().default("in"),
});

// ---------------------------------------------------------------------------
// medications
// ---------------------------------------------------------------------------
export const medications = pgTable("medications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  dose: text("dose"),
  schedule: text("schedule"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// chat
// ---------------------------------------------------------------------------
export const chatSessions = pgTable("chat_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New consult"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").notNull().references(() => chatSessions.id, {
    onDelete: "cascade",
  }),
  role: text("role").$type<ChatRole>().notNull(),
  content: text("content").notNull(),
  redFlag: jsonb("red_flag").$type<RedFlagVerdict | null>(),
  triageBand: text("triage_band").$type<TriageBand | null>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  channel: text("channel").notNull().default("in_app"),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("pending"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// care_plan_tasks — trackable, completable plan items (optionally metric-linked)
// ---------------------------------------------------------------------------
export const carePlanTasks = pgTable("care_plan_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  detail: text("detail"),
  metric: text("metric"),
  status: text("status").$type<"todo" | "doing" | "done">().notNull().default("todo"),
  sourceInsightId: uuid("source_insight_id").references(() => insights.id, { onDelete: "set null" }),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// habit_tags — daily behavior tags for metric-impact correlation
// ---------------------------------------------------------------------------
export const habitTags = pgTable("habit_tags", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tag: text("tag").notNull(),
  day: date("day").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// thread_messages — durable care-team inbox thread on a review flag
// ---------------------------------------------------------------------------
export const threadMessages = pgTable("thread_messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  reviewFlagId: uuid("review_flag_id").references(() => reviewFlags.id, { onDelete: "cascade" }),
  role: text("role").$type<"user" | "reviewer">().notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  simulated: boolean("simulated").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// program_enrollments — multi-week protocol enrollment + progress
// ---------------------------------------------------------------------------
export const programEnrollments = pgTable("program_enrollments", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  programKey: text("program_key").notNull(),
  status: text("status").$type<"active" | "completed">().notNull().default("active"),
  completedSteps: jsonb("completed_steps").$type<number[]>().notNull().default([]),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// journal_entries — symptom / how-you-feel check-ins
// ---------------------------------------------------------------------------
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  day: date("day").notNull(),
  mood: integer("mood"),
  symptoms: text("symptoms"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// med_logs — medication adherence logging
// ---------------------------------------------------------------------------
export const medLogs = pgTable("med_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  medicationId: uuid("medication_id").notNull().references(() => medications.id, { onDelete: "cascade" }),
  takenAt: timestamp("taken_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// report_snapshots — saved health-report snapshots
// ---------------------------------------------------------------------------
export const reportSnapshots = pgTable("report_snapshots", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// app_settings — instance-wide runtime configuration (API keys, model choice).
// A simple encrypted key/value store so an operator can wire real providers
// from the Settings UI without editing env or restarting (CONTEXT.md §17).
// Secret values are encrypted at rest; non-secret values are stored as-is.
// ---------------------------------------------------------------------------
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------------------------------------------------------------------------
// audit_log — append-only record of confirm-gated actions
// ---------------------------------------------------------------------------
export const auditLog = pgTable("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- inferred row types ---------------------------------------------------
export type User = typeof users.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type Observation = typeof observations.$inferSelect;
export type MetricBaseline = typeof metricBaselines.$inferSelect;
export type ReferenceRange = typeof referenceRanges.$inferSelect;
export type DriftSignalRow = typeof driftSignals.$inferSelect;
export type Insight = typeof insights.$inferSelect;
export type ReviewFlag = typeof reviewFlags.$inferSelect;
export type Lab = typeof labs.$inferSelect;
export type LabMarker = typeof labMarkers.$inferSelect;
export type Medication = typeof medications.$inferSelect;
export type ChatSession = typeof chatSessions.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditEntry = typeof auditLog.$inferSelect;
export type CarePlanTask = typeof carePlanTasks.$inferSelect;
export type HabitTag = typeof habitTags.$inferSelect;
export type ThreadMessage = typeof threadMessages.$inferSelect;
export type ProgramEnrollment = typeof programEnrollments.$inferSelect;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type MedLog = typeof medLogs.$inferSelect;
export type ReportSnapshot = typeof reportSnapshots.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
