import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getTimeline, type TimelineCategory } from "@/lib/services/timeline";
import { TimelineIcon } from "@/components/timeline-icon";
import { timeAgo } from "@/lib/utils";

const FILTERS: { key?: TimelineCategory; label: string }[] = [
  { key: undefined, label: "All" },
  { key: "insight", label: "Insights" },
  { key: "lab", label: "Labs" },
  { key: "vital", label: "Vitals" },
  { key: "condition", label: "Conditions" },
  { key: "encounter", label: "Encounters" },
  { key: "sync", label: "Syncs" },
];

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;
  const user = await getSessionUser();
  const cat = category as TimelineCategory | undefined;
  const entries = await getTimeline(user!.id, { category: cat });

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Timeline</h1>
          <p className="sub">Everything in one place, newest first.</p>
        </div>
      </div>

      <div className="quick" style={{ justifyContent: "flex-start", margin: "8px 0 18px" }}>
        {FILTERS.map((f) => {
          const active = (f.key ?? "") === (cat ?? "");
          return (
            <Link
              key={f.label}
              href={f.key ? `/app/timeline?category=${f.key}` : "/app/timeline"}
              className="chip"
              style={active ? { borderColor: "var(--blue-200)", background: "var(--blue-50)", color: "var(--blue-ink)" } : undefined}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div className="box">
        <div className="tl" style={{ padding: "6px 18px 14px" }}>
          {entries.length === 0 && <p className="muted" style={{ padding: "16px 0" }}>Nothing here yet.</p>}
          {entries.map((e) => (
            <div className="tl-item" key={`${e.category}-${e.id}`}>
              <span className="tl-dot">
                <TimelineIcon category={e.category} />
              </span>
              <div className="body">
                <div className="ttl">{e.href ? <Link href={e.href}>{e.title}</Link> : e.title}</div>
                <div className="meta">
                  {e.meta ? `${e.meta} · ` : ""}
                  {timeAgo(e.at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
