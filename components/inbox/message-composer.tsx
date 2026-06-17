"use client";

import { useRef } from "react";
import { Send } from "lucide-react";
import { useFormStatus } from "react-dom";
import { postMessageAction } from "@/app/(app)/app/inbox/actions";

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending} aria-busy={pending}>
      <Send size={15} /> {pending ? "Sending…" : "Send"}
    </button>
  );
}

/**
 * Message composer. Posts to the inbox action, which inserts the user message
 * and a clearly-labeled SIMULATED reviewer auto-reply.
 */
export function MessageComposer({ reviewFlagId }: { reviewFlagId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await postMessageAction(reviewFlagId, formData);
        formRef.current?.reset();
      }}
      className="auth-form"
      style={{ padding: 18 }}
    >
      <label>
        Your message
        <input name="body" type="text" placeholder="Write a reply…" required autoComplete="off" />
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <SendButton />
        <span style={{ fontSize: 12.5, color: "var(--muted-2)" }}>
          Replies are simulated — not from a real clinician.
        </span>
      </div>
    </form>
  );
}
