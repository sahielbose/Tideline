import Link from "next/link";
import {
  MessageCircle,
  RefreshCw,
  TrendingUp,
  FolderHeart,
  Heart,
  FlaskConical,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getDashboard } from "@/lib/services";
import { ackInsightAction, flagInsightAction, syncDataAction } from "@/app/actions";
import { STATUS_CLASS, STATUS_LABEL, SEVERITY_RANK } from "@/lib/types";
import { MetricSpark } from "@/components/metric-spark";
import { InsightActions } from "@/components/insight-actions";
import { ActionButton } from "@/components/action-button";
import { FlagForReview } from "@/components/flag-for-review";
import { TimelineIcon } from "@/components/timeline-icon";
import { HealthIndexCard } from "@/components/dashboard/health-index-card";
import { timeAgo } from "@/lib/utils";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const CONN_ICON = { records: FolderHeart, wearable: Heart, lab: FlaskConical } as const;

export default async function DashboardPage() {
  const user = await getSessionUser();
  const data = await getDashboard(user!.id);
  const firstName = user!.name.split(" ")[0];
  const hero = data.heroInsight;
  const heroIsElevated = hero && SEVERITY_RANK[hero.severity] >= SEVERITY_RANK.elevated;
  const activeCount = data.insights.filter((i) => i.status !== "resolved").length;

  return (
    <div className="wrap">
      <div className="dash-head">
        <div>
          <h1 className="serif h1">
            {greeting()}, {firstName}
          </h1>
          <p className="sub">Here is what changed in your health this week.</p>
        </div>
        <div className="quick-actions">
          <Link className="btn btn-light" href="/app/chat">
            <MessageCircle /> Ask the AI doctor
          </Link>
          <ActionButton action={syncDataAction} className="btn btn-light" toast="Synced your latest data" pendingLabel="Syncing…">
            <RefreshCw /> Sync data
          </ActionButton>
        </div>
      </div>

      {hero && heroIsElevated && (
        <div className="insight-hero">
          <span className="ic">
            <TrendingUp />
          </span>
          <div style={{ flex: 1 }}>
            <h3>
              {hero.title}{" "}
              <span className={`status ${STATUS_CLASS[hero.severity]}`}>
                <span className="dot" />
                {STATUS_LABEL[hero.severity]}
              </span>
            </h3>
            <p>{hero.explanationMd.split("\n")[0]}</p>
            <div className="acts">
              <Link
                className="btn btn-primary"
                style={{ padding: "9px 16px", fontSize: 13.5 }}
                href={hero.metric ? `/app/metrics/${hero.metric}` : `/app/insights/${hero.id}`}
              >
                See details
              </Link>
              <FlagForReview action={flagInsightAction.bind(null, hero.id)} className="btn btn-light flag-btn" />
            </div>
          </div>
        </div>
      )}

      <div className="dash-grid">
        {/* metric cards */}
        <div className="metrics">
          {data.cards.map((c) => (
            <Link key={c.key} href={c.href} className="mcard">
              <div className="top">
                <span className="name">{c.display}</span>
                <span className={`status ${STATUS_CLASS[c.status]}`}>
                  <span className="dot" />
                  {STATUS_LABEL[c.status]}
                </span>
              </div>
              <div className="v">
                {c.value}
                <small>{c.unit}</small>
              </div>
              <div className="base">{c.baseline}</div>
              <MetricSpark data={c.series} status={c.status} />
            </Link>
          ))}
        </div>

        {/* right panel */}
        <div className="panel">
          <HealthIndexCard data={data.healthIndex} />

          <div className="box">
            <div className="bhead">
              What changed <span className="count">{activeCount} active</span>
            </div>
            {data.insights.length === 0 && (
              <div className="ins">
                <p>Nothing notable right now. Your tracked metrics are holding near baseline.</p>
              </div>
            )}
            {data.insights.slice(0, 5).map((i) => (
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
                <InsightActions
                  status={i.status}
                  ackAction={ackInsightAction.bind(null, i.id)}
                  flagAction={flagInsightAction.bind(null, i.id)}
                />
              </div>
            ))}
          </div>

          <div className="box">
            <div className="bhead">Recent timeline</div>
            <div className="tl">
              {data.activity.map((e) => (
                <div className="tl-item" key={e.id}>
                  <span className="tl-dot">
                    <TimelineIcon category={e.category} />
                  </span>
                  <div className="body">
                    <div className="ttl">
                      {e.href ? <Link href={e.href}>{e.title}</Link> : e.title}
                    </div>
                    <div className="meta">{e.meta || timeAgo(e.at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="box">
            <div className="bhead">Connections</div>
            <div className="conn">
              {data.connections.map((c) => {
                const Icon = CONN_ICON[c.kind] ?? FolderHeart;
                return (
                  <div className="conn-item" key={c.id}>
                    <span className="ic">
                      <Icon />
                    </span>
                    <div className="body">
                      <div className="n">{c.label}</div>
                      <div className="s">
                        {c.lastSyncedAt ? `Synced ${timeAgo(c.lastSyncedAt)}` : "Connected"}
                      </div>
                    </div>
                    <span className="status ok">
                      <span className="dot" />
                      Synced
                    </span>
                  </div>
                );
              })}
              <Link className="conn-item" href="/app/connections" style={{ color: "var(--blue-ink)" }}>
                <span className="ic">
                  <RefreshCw />
                </span>
                <div className="body">
                  <div className="n">Manage connections</div>
                  <div className="s">Add records, wearables, or labs</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: 60 }} />
    </div>
  );
}
