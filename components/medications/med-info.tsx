"use client";

import { useState, useTransition } from "react";
import { medInfoAction } from "@/app/actions";
import { Markdown } from "@/components/markdown";

/** Reveal general (non-prescriptive) info for a medication on demand. */
export function MedInfo({ name }: { name: string }) {
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div style={{ marginTop: 8 }}>
      <button
        className="mini-btn"
        disabled={pending}
        onClick={() => {
          if (info) {
            setInfo(null);
            return;
          }
          start(async () => setInfo(await medInfoAction(name)));
        }}
      >
        {pending ? "Loading…" : info ? "Hide info" : "Info"}
      </button>
      {info && (
        <div className="md" style={{ marginTop: 8 }}>
          <Markdown content={info} />
        </div>
      )}
    </div>
  );
}
