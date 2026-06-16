import { getSessionUser } from "@/lib/auth";
import { listSessions, startChat, getSessionMessages } from "@/lib/services";
import { ChatClient } from "@/components/chat/chat-client";
import type { TriageBand } from "@/lib/types";

export default async function ChatPage() {
  const user = await getSessionUser();
  const userId = user?.id ?? null;

  const sessions = userId ? await listSessions(userId) : [];
  const session = sessions[0] ?? (await startChat(userId));
  const msgs = await getSessionMessages(session.id);

  const initial = msgs
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "user" ? "user" : "bot") as "user" | "bot",
      content: m.content,
      triage: (m.triageBand ?? undefined) as TriageBand | undefined,
    }));

  return <ChatClient sessionId={session.id} initialMessages={initial} />;
}
