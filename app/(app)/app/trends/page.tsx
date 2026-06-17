import { TrendingUp, TrendingDown, Minus, LineChart } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getTrends } from "@/lib/services/trends";
import { MetricSpark } from "@/components/metric-spark";

export default async function TrendsPage() {
  const user = await getSessionUser();
  const { metrics, summary, empty } = await getTrends(user!.id);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="serif h1">Trends</h1>
          <p className="sub">Weekly averages across your tracked metrics over the last 8 weeks.</p>
        </div>
      </div>

      <p className="disclaimer" style={{ display: "block", marginBottom: 20 }}>
        These weekly trends are illustrative — not a clinical or diagnostic measurement. Weekly
        averages can move for many ordinary reasons. Tideline is not a medical provider; for anything
        that concerns you, talk with a licensed clinician.
      </p>

      {empty ? (
        <div className="empty">
          <div className="badge-ic">
            <LineChart />
          </div>
          <h2 className="serif h2">No trends yet</h2>
          <p>
            Once a few weeks of readings are connected, your weekly averages and changes will appear
            here.
          </p>
        </div>
      ) : (
        <>
          <div className="box" style={{ marginBottom: 20 }}>
            <div className="bhead">This week, in plain English</div>
            <div className="ins" style={{ borderBottom: "none" }}>
              <p>{summary}</p>
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 60 }}>
            {metrics.map((m) => {
              const Arrow =
                m.direction === "up" ? TrendingUp : m.direction === "down" ? TrendingDown : Minus;
              return (
                <div className="box" key={m.key}>
                  <div className="bhead">
                    <span>{m.display}</span>
                    {m.sparse ? (
                      <span className="status info">
                        <span className="dot" />
                        Not enough data
                      </span>
                    ) : (
                      <span className="chip">
                        <Arrow />
                        {m.deltaLabel ?? "No change"}
                        <span style={{ color: "var(--muted-2)", marginLeft: 4 }}>vs 8 wks ago</span>
                      </span>
                    )}
                  </div>
                  <div className="ins" style={{ borderBottom: "none" }}>
                    {m.weeks.length === 0 ? (
                      <p style={{ color: "var(--muted-2)" }}>No readings in the last 8 weeks.</p>
                    ) : (
                      <>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            marginBottom: 10,
                          }}
                        >
                          <span style={{ fontSize: 22, fontWeight: 600 }}>
                            {m.spark[m.spark.length - 1]}
                          </span>
                          <span style={{ fontSize: 13, color: "var(--muted-2)" }}>
                            {m.unit} · latest weekly avg
                          </span>
                        </div>
                        <MetricSpark data={m.spark} status={m.status} />
                        <p
                          style={{
                            fontSize: 12.5,
                            color: "var(--muted-2)",
                            marginTop: 8,
                          }}
                        >
                          {m.weeks.length} week{m.weeks.length === 1 ? "" : "s"} of data ·{" "}
                          {m.weeks.reduce((n, w) => n + w.count, 0)} reading
                          {m.weeks.reduce((n, w) => n + w.count, 0) === 1 ? "" : "s"}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
