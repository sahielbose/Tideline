import { startChat, getSessionMessages } from "@/lib/services";
import { ChatClient } from "@/components/chat/chat-client";

export const dynamic = "force-dynamic";

/** Public free AI-doctor chat funnel (CONTEXT.md §5). No account required. */
export default async function AiDoctorPage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string }>;
}) {
  const { ask } = await searchParams;
  const session = await startChat(null);
  const msgs = await getSessionMessages(session.id);
  const initial = msgs
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: (m.role === "user" ? "user" : "bot") as "user" | "bot", content: m.content }));

  return <ChatClient sessionId={session.id} initialMessages={initial} autoAsk={ask} showReviewButton={false} />;
}
