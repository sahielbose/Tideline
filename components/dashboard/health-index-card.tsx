import { Activity } from "lucide-react";
import type { HealthIndexResult } from "@/lib/services/health-index";

const COLOR = (i: number) => (i >= 80 ? "#46A86B" : i >= 65 ? "#4C9AD0" : i >= 50 ? "#C99327" : "#C77A3C");

/** A clearly-labeled, illustrative composite health index + health age. */
export function HealthIndexCard({ data }: { data: HealthIndexResult }) {
  if (!data.available) return null;
  const c = COLOR(data.index);
  const r = 34;
  const circ = 2 * Math.PI * r;
  const dash = (data.index / 100) * circ;
  const lowest = data.components[0];

  return (
    <div className="box health-index">
      <div className="bhead">
        Health index
        <span className="count" style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Activity size={12} /> illustrative
        </span>
      </div>
      <div className="hi-body">
        <svg viewBox="0 0 84 84" className="hi-ring" aria-hidden>
          <circle cx="42" cy="42" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
          <circle
            cx="42"
            cy="42"
            r={r}
            fill="none"
            stroke={c}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 42 42)"
          />
          <text x="42" y="40" textAnchor="middle" className="hi-num" fill="var(--ink)">
            {data.index}
          </text>
          <text x="42" y="55" textAnchor="middle" className="hi-of" fill="var(--muted-2)">
            / 100
          </text>
        </svg>
        <div className="hi-meta">
          <div className="hi-label" style={{ color: c }}>
            {data.label}
          </div>
          {data.healthAge != null && data.ageYears != null && (
            <div className="hi-age">
              Health age <strong>{data.healthAge}</strong>
              <span className="muted"> vs {data.ageYears} actual</span>
            </div>
          )}
          {lowest && (
            <div className="hi-opp muted">
              Biggest opportunity: <strong>{lowest.display}</strong>
            </div>
          )}
        </div>
      </div>
      <p className="hi-note">{data.note}</p>
    </div>
  );
}
