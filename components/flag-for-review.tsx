"use client";

import { useState, useTransition } from "react";
import { showToast } from "./toast";

/**
 * Two-step confirm-gated "Flag for review", matching the prototype interaction:
 * first click arms ("Confirm flag"), second click commits. This is one of the
 * confirm gates required by CONTEXT.md §10.6.
 */
export function FlagForReview({
  action,
  className = "mini-btn flag-btn",
}: {
  action: () => Promise<void>;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <button className={`${className} done`} disabled>
        Flagged for review
      </button>
    );
  }

  return (
    <button
      className={className}
      disabled={pending}
      onClick={() => {
        if (armed) {
          start(async () => {
            await action();
            setDone(true);
            setArmed(false);
            showToast("Flagged for clinician review");
          });
        } else {
          setArmed(true);
          setTimeout(() => setArmed(false), 3500);
        }
      }}
    >
      {pending ? "Flagging…" : armed ? "Confirm flag" : "Flag for review"}
    </button>
  );
}
