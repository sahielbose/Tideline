import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listInsights } from "@/lib/services";
import { ackInsightAction, flagInsightAction } from "@/app/actions";
import { InsightActions } from "@/components/insight-actions";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";

export default async function InsightsPage() {
  const user = await getSessionUser();
  const insights = await listInsights(user!.id, { includeResolved: true });

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="serif h1">Insights</h1>
          <p className="sub">What the monitoring engine has noticed, newest and most urgent first.</p>
        </div>
      </div>

      <div className="box" style={{ marginTop: 8, marginBottom: 60 }}>
        {insights.length === 0 && (
          <div className="ins">
            <p>No insights yet. Connect data and run a sync to start monitoring.</p>
          </div>
        )}
        {insights.map((i) => (
          <div className="ins" key={i.id}>
            <div className="ihead">
              <span className={`status ${STATUS_CLASS[i.severity]}`}>
                <span className="dot" />
                {STATUS_LABEL[i.severity]}
              </span>
              <Link className="t" href={`/app/insights/${i.id}`}>
                {i.title}
              </Link>
            </div>
            <p>{i.explanationMd.split("\n")[0]}</p>
            {i.status === "resolved" ? (
              <span className="mini-btn done" style={{ display: "inline-block" }}>
                Resolved
              </span>
            ) : (
              <InsightActions
                status={i.status}
                ackAction={ackInsightAction.bind(null, i.id)}
                flagAction={flagInsightAction.bind(null, i.id)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
