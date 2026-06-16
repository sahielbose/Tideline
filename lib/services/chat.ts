/**
 * Chat services (CONTEXT.md §9.1, §12). Every inbound message is run through the
 * red-flag classifier first; the verdict is persisted on the message and drives
 * the emergency banner. The agent reply is data-aware and ends with a triage
 * band. Used by both the server action and the streaming route handler.
 */
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import {
  chatSessions,
  chatMessages,
  type ChatSession,
  type ChatMessage,
} from "../db/schema";
import {
  classifyRedFlags,
  respond,
  GREETING,
  type AgentContext,
} from "./ai";
import { listInsights } from "./insights";
import { getLatestByMetric, getMetricStatuses } from "./metrics";
import { listLabs, getLab } from "./labs";
import { listMedications } from "./medications";
import { METRICS, formatMetricValue } from "../metrics";
import type {
  AgentReply,
  ChatTurn,
  RedFlagVerdict,
  TriageBand,
} from "../types";

export async function startChat(userId: string | null): Promise<ChatSession> {
  const [session] = await db
    .insert(chatSessions)
    .values({ userId: userId ?? null, title: "AI doctor consult" })
    .returning();
  await db.insert(chatMessages).values({
    sessionId: session.id,
    role: "assistant",
    content: GREETING,
  });
  return session;
}

export async function getSessionMessages(sessionId: string): Promise<ChatMessage[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
}

export async function listSessions(userId: string): Promise<ChatSession[]> {
  return db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.createdAt));
}

/** Build the agent's context block from the user's own data. */
export async function getAgentContext(userId: string | null): Promise<AgentContext> {
  if (!userId) return {};
  const [insightRows, latest, statuses, labRows, meds] = await Promise.all([
    listInsights(userId),
    getLatestByMetric(userId),
    getMetricStatuses(userId),
    listLabs(userId),
    listMedications(userId),
  ]);

  const latestMetrics = ["rhr", "hrv", "glucose", "sleep"]
    .filter((m) => latest[m])
    .map((m) => ({
      metric: m,
      display: METRICS[m]?.display ?? m,
      value: `${formatMetricValue(m, latest[m].value)} ${METRICS[m]?.unit ?? ""}`.trim(),
      status: statuses[m] ?? "normal",
    }));

  const labs = await Promise.all(
    labRows.slice(0, 2).map(async (l) => {
      const full = await getLab(l.id);
      const outOfRange = (full?.markers ?? [])
        .filter((m) => m.flag !== "in")
        .map((m) => m.display);
      return { panelName: l.panelName, outOfRange };
    }),
  );

  return {
    activeInsights: insightRows.slice(0, 4).map((i) => ({ title: i.title, severity: i.severity })),
    latestMetrics,
    labs,
    medications: meds.filter((m) => m.active).map((m) => m.name),
  };
}

export interface SendResult {
  verdict: RedFlagVerdict;
  reply: AgentReply;
  assistantMessageId: string;
}

/**
 * Classify, persist the user message + verdict, generate the reply, persist it,
 * and return both. The streaming route streams `reply.content` afterwards.
 */
export async function sendMessage(
  sessionId: string,
  text: string,
  userId: string | null,
): Promise<SendResult> {
  const verdict = await classifyRedFlags(text);
  await db.insert(chatMessages).values({
    sessionId,
    role: "user",
    content: text,
    redFlag: verdict,
  });

  const history = await getSessionMessages(sessionId);
  const turns: ChatTurn[] = history.map((m) => ({ role: m.role, content: m.content }));
  const ctx = await getAgentContext(userId);
  const reply = await respond(turns, ctx, verdict);

  const [assistant] = await db
    .insert(chatMessages)
    .values({
      sessionId,
      role: "assistant",
      content: reply.content,
      triageBand: reply.triage as TriageBand,
    })
    .returning();

  return { verdict, reply, assistantMessageId: assistant.id };
}
