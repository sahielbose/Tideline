"use client";

import { useTransition } from "react";
import { Check, CalendarRange } from "lucide-react";
import { enrollProgramAction, toggleProgramStepAction } from "@/app/(app)/app/programs/actions";
import { showToast } from "@/components/toast";

interface Step {
  title: string;
  detail: string;
}

export function ProgramCard({
  programKey,
  title,
  weeks,
  goal,
  steps,
  enrolled,
  completed,
  completedSteps,
  progressPct,
}: {
  programKey: string;
  title: string;
  weeks: number;
  goal: string;
  steps: Step[];
  enrolled: boolean;
  completed: boolean;
  completedSteps: number[];
  progressPct: number;
}) {
  const [pending, start] = useTransition();
  const doneSet = new Set(completedSteps);

  const statusCls = completed ? "ok" : enrolled ? "info" : "watch";
  const statusLabel = completed ? "Completed" : enrolled ? "In progress" : "Not started";

  return (
    <div className="box" style={{ marginBottom: 16, opacity: pending ? 0.7 : 1 }}>
      <div className="bhead">
        <span>{title}</span>
        <span className={`status ${statusCls}`}>
          <span className="dot" />
          {statusLabel}
        </span>
      </div>

      <div className="ins" style={{ borderBottom: enrolled ? undefined : "none" }}>
        <p style={{ marginBottom: 10 }}>{goal}</p>
        <p className="s" style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--muted-2)", fontSize: 12.5 }}>
          <CalendarRange size={14} /> {weeks}-week routine · {steps.length} steps
          {enrolled ? ` · ${progressPct}% complete` : ""}
        </p>

        {!enrolled && (
          <div className="acts" style={{ marginTop: 12 }}>
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await enrollProgramAction(programKey);
                  showToast("Enrolled — illustrative routine");
                })
              }
            >
              {pending ? "Enrolling…" : "Enroll"}
            </button>
          </div>
        )}
      </div>

      {enrolled && (
        <>
          {steps.map((step, i) => {
            const done = doneSet.has(i);
            return (
              <div className="conn-item" key={i} style={{ padding: "12px 18px" }}>
                <button
                  className="task-check"
                  data-done={done ? "1" : "0"}
                  aria-label={done ? "Mark step not done" : "Mark step done"}
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await toggleProgramStepAction(programKey, i);
                    })
                  }
                >
                  {done && <Check size={14} />}
                </button>
                <div className="body">
                  <div
                    className="n"
                    style={{
                      textDecoration: done ? "line-through" : "none",
                      color: done ? "var(--muted-2)" : "var(--ink)",
                    }}
                  >
                    {`Week ${i + 1}: ${step.title}`}
                  </div>
                  <div className="s">{step.detail}</div>
                </div>
              </div>
            );
          })}
          {completed && (
            <div className="ins" style={{ borderBottom: "none" }}>
              <p className="s" style={{ color: "var(--ok-tx)", fontSize: 12.5 }}>
                You have worked through every step of this illustrative routine. Nice consistency.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
