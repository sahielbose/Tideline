import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getBiomarkers } from "@/lib/services";
import { MetricSpark } from "@/components/metric-spark";
import { MARKER_STATUS_CHIP, type MarkerStatus } from "@/lib/lab-reference";
import type { MetricStatus } from "@/lib/types";

const TO_METRIC_STATUS: Record<MarkerStatus, MetricStatus> = {
  optimal: "normal",
  in: "normal",
  suboptimal: "info",
  low: "watch",
  high: "elevated",
};

function rangeText(low: number | null, high: number | null, unit: string): string {
  if (low != null && high != null) return `${low}–${high} ${unit}`;
  if (high != null) return `< ${high} ${unit}`;
  if (low != null) return `> ${low} ${unit}`;
  return "—";
}

export default async function BiomarkersPage() {
  const user = await getSessionUser();
  const markers = await getBiomarkers(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Biomarkers</h1>
          <p className="sub">Every lab marker, trended across your draws, against optimal ranges.</p>
        </div>
      </div>

      {markers.length === 0 ? (
        <div className="empty">
          <h2 className="serif h2">No markers yet</h2>
          <p>Upload or load labs to see your biomarkers trend over time.</p>
        </div>
      ) : (
        <div className="metrics" style={{ marginTop: 8 }}>
          {markers.map((m) => {
            const chip = MARKER_STATUS_CHIP[m.status];
            const delta = m.previous != null ? m.latest - m.previous : null;
            const Arrow = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
            return (
              <div className="mcard" key={m.code}>
                <div className="top">
                  <span className="name">{m.display}</span>
                  <span className={`status ${chip.cls}`}>
                    <span className="dot" />
                    {m.status === "optimal" ? "Optimal" : m.status === "suboptimal" ? "Suboptimal" : chip.label}
                  </span>
                </div>
                <div className="v">
                  {m.latest}
                  <small>{m.unit}</small>
                </div>
                <div className="base" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {delta != null && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--muted)" }}>
                      <Arrow size={13} />
                      {delta > 0 ? "+" : ""}
                      {Math.round(delta * 100) / 100} vs prior
                    </span>
                  )}
                  <span>· ref {rangeText(m.refLow, m.refHigh, m.unit)}</span>
                </div>
                {m.optimalLow != null || m.optimalHigh != null ? (
                  <div className="base">optimal {rangeText(m.optimalLow, m.optimalHigh, m.unit)}</div>
                ) : null}
                {m.history.length > 1 && (
                  <MetricSpark data={m.history.map((h) => h.value)} status={TO_METRIC_STATUS[m.status]} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
