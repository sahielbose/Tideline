"use client";

import { useTransition } from "react";
import { Check, Plus } from "lucide-react";
import { logDoseAction } from "@/app/(app)/app/adherence/actions";
import { showToast } from "@/components/toast";

/** Log a single dose for a medication (tracking only — never prescribing). */
export function LogDoseButton({ medicationId }: { medicationId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      className="mini-btn"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await logDoseAction(medicationId);
          showToast("Dose logged");
        })
      }
    >
      {pending ? (
        <>
          <Check /> Logging…
        </>
      ) : (
        <>
          <Plus /> Log dose
        </>
      )}
    </button>
  );
}
