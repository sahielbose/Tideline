"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Stethoscope, Lock, ArrowUp, TriangleAlert } from "lucide-react";
import {
  TRIAGE_LABEL,
  TRIAGE_STATUS_CLASS,
  type TriageBand,
} from "@/lib/types";
import { requestVisitAction } from "@/app/actions";
import { showToast } from "@/components/toast";

interface Msg {
  id: string;
  role: "user" | "bot";
  content: string;
  triage?: TriageBand;
  done?: boolean;
}

const DEFAULT_SUGGESTIONS = [
  "I've had a headache for three days",
  "My sleep has been poor lately",
  "Explain my latest labs",
  "I have chest pain",
];

export function ChatClient({
  sessionId,
  initialMessages,
  showReviewButton = true,
}: {
  sessionId: string;
  initialMessages: { role: "user" | "bot"; content: string; triage?: TriageBand }[];
  showReviewButton?: boolean;
}) {
  const [messages, setMessages] = useState<Msg[]>(
    initialMessages.map((m, i) => ({ id: `init-${i}`, done: true, ...m })),
  );
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [emergency, setEmergency] = useState(false);
  const [crisis, setCrisis] = useState(false);
  const [suggestVisible, setSuggestVisible] = useState(true);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);
  const askedRef = useRef(false);

  const scroll = () => {
    requestAnimationFrame(() => {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
    });
  };

  const animate = (id: string, full: string) => {
    const words = full.split(" ");
    let i = 0;
    const tick = () => {
      i++;
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, content: words.slice(0, i).join(" ") } : m)),
      );
      scroll();
      if (i < words.length) setTimeout(tick, 16);
      else setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, done: true } : m)));
    };
    tick();
  };

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setSuggestVisible(false);
    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "user", content: t, done: true }]);
    setInput("");
    setTyping(true);
    scroll();
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, text: t }),
      });
      const raw = await res.text();
      const nl = raw.indexOf("\n");
      const metaStr = nl >= 0 ? raw.slice(0, nl) : "{}";
      const content = nl >= 0 ? raw.slice(nl + 1) : raw;
      let meta: { emergency?: boolean; crisis?: boolean; triage?: TriageBand } = {};
      try {
        meta = JSON.parse(metaStr);
      } catch {
        /* ignore */
      }
      setEmergency(Boolean(meta.emergency));
      setCrisis(Boolean(meta.crisis));
      setTyping(false);
      const id = crypto.randomUUID();
      setMessages((prev) => [...prev, { id, role: "bot", content: "", triage: meta.triage }]);
      animate(id, content);
    } catch {
      setTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "bot",
          content: "Sorry, something went wrong reaching the assistant. Please try again.",
          done: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (askedRef.current) return;
    const pending = typeof window !== "undefined" ? sessionStorage.getItem("tideline_ask") : null;
    if (pending) {
      askedRef.current = true;
      sessionStorage.removeItem("tideline_ask");
      void send(pending);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestReview = () => {
    startTransition(async () => {
      await requestVisitAction("Requested a clinician review from chat");
      showToast("Sent to the review queue");
    });
  };

  return (
    <div className="wrap chat-wrap">
      <div className="chat-bar">
        <div className="title">
          <span className="ic">
            <Stethoscope />
          </span>
          AI Doctor
        </div>
        {showReviewButton && (
          <button
            className="btn btn-ghost-blue"
            style={{ fontSize: 13.5, padding: "9px 15px" }}
            onClick={requestReview}
          >
            Request clinician review
          </button>
        )}
      </div>

      <div className={`emergency ${emergency ? "show" : ""}`}>
        <TriangleAlert />
        <span>
          {crisis
            ? "You're not alone — call or text 988 (Suicide & Crisis Lifeline) now, available 24/7. If you're in immediate danger, call your local emergency number."
            : "If this is an emergency, call your local emergency number now or go to the nearest emergency room."}
        </span>
      </div>

      <div className="thread" ref={threadRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg ${m.role}`}>
            {m.content}
            {m.role === "bot" && m.done && m.triage && (
              <>
                <span className={`status ${TRIAGE_STATUS_CLASS[m.triage]} triage`}>
                  <span className="dot" />
                  {TRIAGE_LABEL[m.triage]}
                </span>
                <span className="note">
                  Informational only. Tideline is not a licensed medical provider.
                </span>
              </>
            )}
          </div>
        ))}
        {typing && (
          <div className="msg bot">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
      </div>

      {suggestVisible && (
        <div className="suggest">
          {DEFAULT_SUGGESTIONS.map((s) => (
            <button key={s} className="chip" onClick={() => send(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="composer">
        <Lock className="lock" />
        <input
          type="text"
          placeholder="Tell me about your symptoms or health concerns…"
          aria-label="Message the AI doctor"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send(input)}
        />
        <button className="send" aria-label="Send" onClick={() => send(input)} disabled={busy}>
          <ArrowUp />
        </button>
      </div>
      <p className="chat-foot">
        <Lock /> Encrypted, and not a substitute for professional medical care
      </p>
      <div style={{ height: 50 }} />
    </div>
  );
}
