import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, LineChart } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getInsight } from "@/lib/services";
import { ackInsightAction, flagInsightAction } from "@/app/actions";
import { InsightActions } from "@/components/insight-actions";
import { Markdown } from "@/components/markdown";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { METRICS } from "@/lib/metrics";

export default async function InsightDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const insight = await getInsight(user!.id, id);
  if (!insight) notFound();

  const metricName = insight.metric ? METRICS[insight.metric]?.display : null;

  return (
    <div className="wrap" style={{ maxWidth: 820, marginBottom: 60 }}>
      <div style={{ paddingTop: 28 }}>
        <Link className="chip soft" href="/app/insights">
          <ArrowLeft /> All insights
        </Link>
      </div>

      <div className="page-head" style={{ paddingTop: 18 }}>
        <div>
          <h1 className="serif h2" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {insight.title}
            <span className={`status ${STATUS_CLASS[insight.severity]}`}>
              <span className="dot" />
              {STATUS_LABEL[insight.severity]}
            </span>
          </h1>
        </div>
      </div>

      <div className="box" style={{ marginTop: 8 }}>
        <div className="ins" style={{ borderBottom: "none" }}>
          <Markdown content={insight.explanationMd} />
          <div className="disclaimer" style={{ margin: "16px 0", display: "block" }}>
            <strong>Recommended next step:</strong> {insight.recommendedAction}
          </div>
          <div className="acts" style={{ marginTop: 6 }}>
            {insight.metric && (
              <Link className="btn btn-primary" style={{ padding: "9px 16px", fontSize: 13.5 }} href={`/app/metrics/${insight.metric}`}>
                <LineChart /> See {metricName ?? "metric"} detail
              </Link>
            )}
            {insight.status !== "resolved" && (
              <InsightActions
                status={insight.status}
                ackAction={ackInsightAction.bind(null, insight.id)}
                flagAction={flagInsightAction.bind(null, insight.id)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
