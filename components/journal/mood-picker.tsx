"use client";

import { useState } from "react";

const MOODS: { value: number; label: string }[] = [
  { value: 1, label: "Rough" },
  { value: 2, label: "Low" },
  { value: 3, label: "Okay" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
];

/**
 * 1–5 mood selector backed by a hidden input so it submits with the form.
 * Self-report only — not a clinical measurement.
 */
export function MoodPicker({ name = "mood" }: { name?: string }) {
  const [mood, setMood] = useState<number | null>(null);
  return (
    <div>
      <input type="hidden" name={name} value={mood ?? ""} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {MOODS.map((m) => (
          <button
            type="button"
            key={m.value}
            className={mood === m.value ? "btn btn-primary" : "btn btn-light"}
            aria-pressed={mood === m.value}
            onClick={() => setMood(mood === m.value ? null : m.value)}
          >
            {m.value} · {m.label}
          </button>
        ))}
      </div>
    </div>
  );
}
