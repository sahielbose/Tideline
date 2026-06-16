import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getActionPlan } from "@/lib/services/plan";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";

export default async function PlanPage() {
  const user = await getSessionUser();
  const plan = await getActionPlan(user!.id);

  return (
    <div className="wrap" style={{ maxWidth: 860, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Your action plan</h1>
          <p className="sub">{plan.summary}</p>
        </div>
      </div>

      {plan.groups.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <ClipboardList />
          </div>
          <h2 className="serif h2">Nothing to act on</h2>
          <p>Your tracked metrics are holding near baseline. We&apos;ll surface steps here when something drifts.</p>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 8 }}>
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
                  <p style={{ marginBottom: 6 }}>{it.action}</p>
                  {it.metric && (
                    <Link className="mini-btn" href={`/app/metrics/${it.metric}`} style={{ display: "inline-block" }}>
                      See the trend
                    </Link>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ClipboardList />
        <span>This plan is general, hedged guidance generated from your monitoring insights — not medical advice or a treatment plan. Review it with a licensed clinician.</span>
      </div>
    </div>
  );
}
