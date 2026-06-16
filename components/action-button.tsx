"use client";

import { SubmitButton } from "./submit-button";
import { showToast } from "./toast";

/** A button that runs a (bound) server action via a form, with toast feedback. */
export function ActionButton({
  action,
  children,
  className = "btn btn-light",
  toast,
  pendingLabel,
}: {
  action: () => Promise<void> | void;
  children: React.ReactNode;
  className?: string;
  toast?: string;
  pendingLabel?: string;
}) {
  return (
    <form
      action={action}
      style={{ display: "inline" }}
      onSubmit={() => {
        if (toast) showToast(toast);
      }}
    >
      <SubmitButton className={className} pendingLabel={pendingLabel}>
        {children}
      </SubmitButton>
    </form>
  );
}
