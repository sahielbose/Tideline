import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getMetricSeries, getBaselines, getMetricStatuses, listInsights } from "@/lib/services";
import { METRICS, formatMetricValue } from "@/lib/metrics";
import { MetricChart } from "@/components/metric-chart";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";

export default async function MetricDetailPage({ params }: { params: Promise<{ metric: string }> }) {
  const { metric } = await params;
  const def = METRICS[metric];
  if (!def) notFound();

  const user = await getSessionUser();
  const [series, baselines, statuses, insights] = await Promise.all([
    getMetricSeries(user!.id, metric, 120),
    getBaselines(user!.id),
    getMetricStatuses(user!.id),
    listInsights(user!.id, { includeResolved: true }),
  ]);

  const status = statuses[metric] ?? "normal";
  const baseline = baselines[metric];
  const latest = series.length ? series[series.length - 1].v : null;
  const related = insights.find((i) => i.metric === metric);

  return (
    <div className="wrap" style={{ maxWidth: 920, marginBottom: 60 }}>
      <div style={{ paddingTop: 28 }}>
        <Link className="chip soft" href="/app">
          <ArrowLeft /> Dashboard
        </Link>
      </div>

      <div className="page-head" style={{ paddingTop: 18 }}>
        <div>
          <h1 className="serif h2" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {def.display}
            <span className={`status ${STATUS_CLASS[status]}`}>
              <span className="dot" />
              {STATUS_LABEL[status]}
            </span>
          </h1>
          <p className="sub">
            {latest != null ? (
              <>
                Latest <strong>{formatMetricValue(metric, latest)} {def.unit}</strong>
                {baseline ? ` · baseline ${formatMetricValue(metric, baseline.center)} ${def.unit}` : ""}
                {def.refLow != null && def.refHigh != null
                  ? ` · reference ${def.refLow}–${def.refHigh} ${def.unit}`
                  : ""}
              </>
            ) : (
              "No readings yet."
            )}
          </p>
        </div>
      </div>

      <div className="box" style={{ padding: 18 }}>
        <MetricChart
          series={series}
          status={status}
          baseline={baseline ? { center: baseline.center, spread: baseline.spread } : null}
          refLow={def.refLow}
          refHigh={def.refHigh}
        />
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginTop: 14, fontSize: 13, color: "var(--muted)" }}>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(76,154,208,.4)", borderRadius: 3, marginRight: 6 }} />Personal baseline band</span>
          <span><span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(70,168,107,.4)", borderRadius: 3, marginRight: 6 }} />Reference range</span>
        </div>
      </div>

      {related && (
        <div className="box" style={{ marginTop: 20 }}>
          <div className="bhead">
            Related insight
            <span className={`status ${STATUS_CLASS[related.severity]}`}>
              <span className="dot" />
              {STATUS_LABEL[related.severity]}
            </span>
          </div>
          <div className="ins" style={{ borderBottom: "none" }}>
            <p style={{ marginBottom: 10 }}>{related.explanationMd.split("\n")[0]}</p>
            <Link className="mini-btn" href={`/app/insights/${related.id}`} style={{ display: "inline-block" }}>
              Open insight
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
