"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ShieldAlert } from "lucide-react";
import { SubmitButton } from "./submit-button";
import { showToast } from "./toast";

/**
 * Confirm-gated action behind an explicit dialog (CONTEXT.md §10.6): used for
 * email opt-in, the mocked visit booking, resolving a review, data export, and
 * data delete. Wraps a bound server action passed as `action`.
 */
export function ConfirmAction({
  action,
  triggerLabel,
  triggerClassName = "btn btn-light",
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  successToast,
}: {
  action: () => Promise<void> | void;
  triggerLabel: React.ReactNode;
  triggerClassName?: string;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  successToast?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger className={triggerClassName}>{triggerLabel}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content">
          <div className="dialog-head">
            <span className={`dialog-ic ${destructive ? "danger" : ""}`}>
              <ShieldAlert />
            </span>
            <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          </div>
          <Dialog.Description className="dialog-desc">{description}</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close className="btn btn-light">Cancel</Dialog.Close>
            <form
              action={action}
              onSubmit={() => {
                if (successToast) showToast(successToast);
                setOpen(false);
              }}
            >
              <SubmitButton
                className={`btn ${destructive ? "btn-danger" : "btn-primary"}`}
                pendingLabel="Working…"
              >
                {confirmLabel}
              </SubmitButton>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
