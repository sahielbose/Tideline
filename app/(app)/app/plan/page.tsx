import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getActionPlan, listCarePlanTasks } from "@/lib/services";
import { addCarePlanTaskAction, addTaskFromInsightAction } from "@/app/actions";
import { CarePlanTaskItem } from "@/components/plan/task-item";
import { ActionButton } from "@/components/action-button";
import { SubmitButton } from "@/components/submit-button";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";

export default async function PlanPage() {
  const user = await getSessionUser();
  const [plan, tasks] = await Promise.all([getActionPlan(user!.id), listCarePlanTasks(user!.id)]);
  const done = tasks.filter((t) => t.status === "done").length;
  const trackedInsightIds = new Set(tasks.map((t) => t.sourceInsightId).filter(Boolean));

  return (
    <div className="wrap" style={{ maxWidth: 880, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Your action plan</h1>
          <p className="sub">{plan.summary}</p>
        </div>
      </div>

      {/* Tracked tasks */}
      <div className="box" style={{ marginTop: 8 }}>
        <div className="bhead">
          Tasks
          <span className="count">{tasks.length ? `${done}/${tasks.length} done` : "none yet"}</span>
        </div>
        {tasks.length > 0 && (
          <div style={{ height: 6, background: "var(--line)", margin: "0 18px" }}>
            <div style={{ width: `${tasks.length ? (done / tasks.length) * 100 : 0}%`, height: "100%", background: "var(--ok-tx)" }} />
          </div>
        )}
        {tasks.map((t) => (
          <CarePlanTaskItem key={t.id} id={t.id} title={t.title} detail={t.detail} done={t.status === "done"} />
        ))}
        <form action={addCarePlanTaskAction} className="composer" style={{ margin: 16 }}>
          <Plus size={16} style={{ color: "var(--muted-2)" }} />
          <input name="title" placeholder="Add your own task…" aria-label="New task" />
          <SubmitButton className="send" pendingLabel="…">
            <Plus size={18} />
          </SubmitButton>
        </form>
      </div>

      {/* Suggestions from insights */}
      {plan.groups.length > 0 && (
        <div className="panel" style={{ marginTop: 24 }}>
          {plan.groups.map((g) => (
            <div className="box" key={g.key}>
              <div className="bhead">
                {g.title}
                <span className="count">{g.items.length}</span>
              </div>
              <div className="ins" style={{ borderBottom: "none", paddingBottom: 6 }}>
                <p style={{ marginBottom: 4 }}>{g.description}</p>
              </div>
              {g.items.map((it) => (
                <div className="ins" key={it.insightId}>
                  <div className="ihead">
                    <span className={`status ${STATUS_CLASS[it.severity]}`}>
                      <span className="dot" />
                      {STATUS_LABEL[it.severity]}
                    </span>
                    <Link className="t" href={`/app/insights/${it.insightId}`}>
                      {it.title}
                    </Link>
                  </div>
                  <p style={{ marginBottom: 8 }}>{it.action}</p>
                  {trackedInsightIds.has(it.insightId) ? (
                    <span className="mini-btn done" style={{ display: "inline-block" }}>Added to plan</span>
                  ) : (
                    <ActionButton
                      action={addTaskFromInsightAction.bind(null, it.insightId, it.action, it.metric)}
                      className="mini-btn"
                      toast="Added to your plan"
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Plus size={13} /> Add to plan
                      </span>
                    </ActionButton>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ClipboardList />
        <span>This plan is general, hedged guidance from your monitoring insights — not medical advice or a treatment plan. Tasks linked to a metric auto-complete when it returns to baseline.</span>
      </div>
    </div>
  );
}
