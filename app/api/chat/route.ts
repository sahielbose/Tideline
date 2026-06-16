/**
 * Chat streaming route handler (CONTEXT.md §5, §14). Runs the red-flag
 * classifier + agent via the service layer, persists the turn, and streams the
 * reply back to the UI. The first line is a JSON meta envelope (red-flag verdict
 * + triage band), then the reply content streams.
 */
import { NextRequest } from "next/server";
import { sendMessage, getChatSession } from "@/lib/services";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { sessionId?: string; text?: string };
  try {
    body = await req.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  const sessionId = body.sessionId?.trim();
  const text = body.text?.trim();
  if (!sessionId || !text) return new Response("Missing sessionId or text", { status: 400 });

  const session = await getChatSession(sessionId);
  if (!session) return new Response("Session not found", { status: 404 });

  const { verdict, reply } = await sendMessage(sessionId, text, session.userId ?? null);

  const meta = JSON.stringify({
    type: "meta",
    emergency: verdict.emergency,
    crisis: verdict.crisis,
    category: verdict.category,
    triage: reply.triage,
  });

  const encoder = new TextEncoder();
  const words = reply.content.split(" ");
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(meta + "\n"));
      let i = 0;
      const pump = () => {
        if (i < words.length) {
          controller.enqueue(encoder.encode((i === 0 ? "" : " ") + words[i]));
          i++;
          setTimeout(pump, 16);
        } else {
          controller.close();
        }
      };
      pump();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
