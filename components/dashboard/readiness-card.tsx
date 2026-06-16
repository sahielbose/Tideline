import { Gauge } from "lucide-react";
import type { Readiness } from "@/lib/services/readiness";

const COLOR = (i: number) => (i >= 80 ? "#46A86B" : i >= 65 ? "#4C9AD0" : i >= 50 ? "#C99327" : "#C77A3C");

/** Illustrative daily readiness ring + worst contributor (Oura/Whoop-style). */
export function ReadinessCard({ data }: { data: Readiness }) {
  if (data.available < 2) return null;
  const c = COLOR(data.score);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (data.score / 100) * circ;
  const worst = data.contributors[0];

  return (
    <div className="box health-index">
      <div className="bhead">
        Daily readiness
        <span className="count" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Gauge size={12} /> illustrative
        </span>
      </div>
      <div className="hi-body">
        <svg viewBox="0 0 84 84" className="hi-ring" aria-hidden>
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
          <circle cx="42" cy="42" r={r} fill="none" stroke={c} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 42 42)" />
          <text x="42" y="40" textAnchor="middle" className="hi-num" fill="var(--ink)">{data.score}</text>
          <text x="42" y="55" textAnchor="middle" className="hi-of" fill="var(--muted-2)">/ 100</text>
        </svg>
        <div className="hi-meta">
          <div className="hi-label" style={{ color: c }}>{data.label}</div>
          {worst && (
            <div className="hi-opp muted">
              Biggest drag: <strong>{worst.display}</strong>{" "}
              {worst.deltaPct !== 0 ? `(${worst.deltaPct > 0 ? "+" : ""}${worst.deltaPct}% vs baseline)` : ""}
            </div>
          )}
        </div>
      </div>
      <p className="hi-note">{data.note}</p>
    </div>
  );
}
