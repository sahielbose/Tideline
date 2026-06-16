"use client";

import { ActionButton } from "./action-button";
import { FlagForReview } from "./flag-for-review";

/** Acknowledge + (two-step) Flag-for-review actions for an insight. */
export function InsightActions({
  status,
  ackAction,
  flagAction,
}: {
  status: string;
  ackAction: () => Promise<void>;
  flagAction: () => Promise<void>;
}) {
  return (
    <div className="acts">
      {status === "acknowledged" ? (
        <button className="mini-btn done" disabled>
          Acknowledged
        </button>
      ) : (
        <ActionButton action={ackAction} className="mini-btn" toast="Acknowledged">
          Acknowledge
        </ActionButton>
      )}
      {status === "flagged" ? (
        <button className="mini-btn done" disabled>
          Flagged for review
        </button>
      ) : (
        <FlagForReview action={flagAction} />
      )}
    </div>
  );
}
