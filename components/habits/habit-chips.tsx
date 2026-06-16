"use client";

import { useState, useTransition } from "react";
import { toggleHabitAction } from "@/app/actions";

export function HabitChips({ tags, today }: { tags: string[]; today: string[] }) {
  const [on, setOn] = useState<string[]>(today);
  const [pending, start] = useTransition();
  return (
    <div className="quick" style={{ justifyContent: "flex-start", margin: "8px 0 0" }}>
      {tags.map((t) => {
        const active = on.includes(t);
        return (
          <button
            key={t}
            className="chip"
            disabled={pending}
            style={active ? { borderColor: "var(--blue-200)", background: "var(--blue-50)", color: "var(--blue-ink)" } : undefined}
            onClick={() =>
              start(async () => {
                await toggleHabitAction(t);
                setOn((s) => (active ? s.filter((x) => x !== t) : [...s, t]));
              })
            }
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
