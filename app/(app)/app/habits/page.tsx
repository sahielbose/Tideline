import { Tag, TrendingUp, TrendingDown } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listTodayTags, getHabitCorrelations, HABIT_TAGS } from "@/lib/services";
import { HabitChips } from "@/components/habits/habit-chips";

export default async function HabitsPage() {
  const user = await getSessionUser();
  const [today, correlations] = await Promise.all([
    listTodayTags(user!.id),
    getHabitCorrelations(user!.id),
  ]);

  return (
    <div className="wrap" style={{ maxWidth: 820, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Habits</h1>
          <p className="sub">Tag what you did today, and see how it tracks with your vitals.</p>
        </div>
      </div>

      <div className="box" style={{ marginTop: 8 }}>
        <div className="bhead">Today</div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <HabitChips tags={HABIT_TAGS} today={today} />
        </div>
      </div>

      <div className="box" style={{ marginTop: 24 }}>
        <div className="bhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Tag size={16} /> Associations
          </span>
        </div>
        {correlations.length === 0 ? (
          <div className="ins"><p>Tag a few days to see how your habits track with resting heart rate, HRV, and sleep.</p></div>
        ) : (
          correlations.map((c) => (
            <div className="ins" key={c.tag}>
              <div className="ihead">
                <span className="t">{c.tag}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{c.n} days tagged</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {c.effects.map((e) => {
                  const up = e.deltaPct > 0;
                  const Arrow = e.deltaPct === 0 ? Tag : up ? TrendingUp : TrendingDown;
                  return (
                    <div key={e.metric} style={{ fontSize: 14, color: "var(--muted)", display: "flex", alignItems: "center", gap: 6 }}>
                      <Arrow size={14} />
                      On days you tagged {c.tag.toLowerCase()}, <strong style={{ color: "var(--ink)" }}>{e.display}</strong> averaged{" "}
                      {e.taggedAvg} {e.unit} ({up ? "+" : ""}{e.deltaPct}% vs other days).
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <Tag />
        <span>These are simple correlations over your own data (associated with, not caused by) and small samples are hidden. Not medical advice.</span>
      </div>
    </div>
  );
}
