"use client";

import { useTransition } from "react";
import { Check, Trash2 } from "lucide-react";
import { toggleCarePlanTaskAction, deleteCarePlanTaskAction } from "@/app/actions";

export function CarePlanTaskItem({
  id,
  title,
  detail,
  done,
}: {
  id: string;
  title: string;
  detail: string | null;
  done: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="conn-item" style={{ padding: "12px 18px", opacity: pending ? 0.6 : 1 }}>
      <button
        className="task-check"
        data-done={done ? "1" : "0"}
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={() => start(() => toggleCarePlanTaskAction(id, !done))}
      >
        {done && <Check size={14} />}
      </button>
      <div className="body">
        <div className="n" style={{ textDecoration: done ? "line-through" : "none", color: done ? "var(--muted-2)" : "var(--ink)" }}>
          {title}
        </div>
        {detail && <div className="s">{detail}</div>}
      </div>
      <button className="icon-btn" aria-label="Delete task" onClick={() => start(() => deleteCarePlanTaskAction(id))}>
        <Trash2 size={15} />
      </button>
    </div>
  );
}
