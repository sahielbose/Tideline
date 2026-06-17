import { Activity, Heart, Info, ShieldAlert, TrendingUp } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getLongevity } from "@/lib/services/longevity";

const BAND_CHIP = {
  favorable: { cls: "ok", label: "Favorable" },
  watch: { cls: "watch", label: "Watch" },
  elevated: { cls: "elev", label: "Elevated" },
} as const;

/** Map a percentile to a status class, respecting whether higher is better. */
function pctClass(percentile: number, higherIsBetter: boolean): string {
  const good = higherIsBetter ? percentile : 100 - percentile;
  if (good >= 66) return "ok";
  if (good >= 34) return "watch";
  return "elev";
}

export default async function LongevityPage() {
  const user = await getSessionUser();
  const { cardio, percentiles, methodology, hasData } = await getLongevity(user!.id);
  const chip = BAND_CHIP[cardio.band];

  return (
    <div className="wrap" style={{ maxWidth: 880, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Longevity panel</h1>
          <p className="sub">
            An illustrative look at cardiovascular factors and how a few metrics compare — not a diagnosis.
          </p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginBottom: 20 }}>
        <ShieldAlert />
        <span>
          Everything on this page is <strong>illustrative — not a clinical or diagnostic measurement</strong>.
          The cardiovascular band is a simple point total, <strong>not a real ASCVD risk percentage</strong>, and
          percentiles use rough reference values. This is not medical advice and is not a substitute for a
          licensed clinician.
        </span>
      </div>

      {!hasData && (
        <div className="empty" style={{ marginBottom: 20 }}>
          <div className="badge-ic">
            <Heart />
          </div>
          <h2 className="serif h2">Not enough data yet</h2>
          <p>
            Add your date of birth and sex in settings, connect a wearable, and import a lipid panel to populate
            this illustrative view.
          </p>
        </div>
      )}

      <div className="box">
        <div className="bhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Heart size={16} /> Illustrative cardiovascular band
          </span>
          <span className={`status ${chip.cls}`}>
            <span className="dot" />
            {chip.label}
          </span>
        </div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
            <span className="serif" style={{ fontSize: 34, lineHeight: 1 }}>{cardio.score}</span>
            <span className="muted" style={{ fontSize: 13 }}>/ 100 illustrative points</span>
          </div>

          {/* Band track */}
          <div
            style={{
              height: 8,
              borderRadius: 999,
              background: "var(--line, #e5e5e5)",
              overflow: "hidden",
              marginBottom: 12,
            }}
            aria-hidden
          >
            <div
              style={{
                width: `${cardio.score}%`,
                height: "100%",
                borderRadius: 999,
                background: "currentColor",
              }}
              className={`status ${chip.cls}`}
            />
          </div>

          {cardio.drivers.length > 0 && (
            <>
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 6 }}>Main contributors</p>
              <ul style={{ paddingLeft: 18, margin: "0 0 10px", color: "var(--muted)", fontSize: 14 }}>
                {cardio.drivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </>
          )}

          {cardio.missing.length > 0 && (
            <p className="muted" style={{ fontSize: 12.5, marginBottom: 8 }}>
              Add {cardio.missing.join(", ")} for a fuller illustrative picture.
            </p>
          )}

          <p className="muted" style={{ fontSize: 12.5 }}>
            This band is <strong>illustrative — not a clinical or diagnostic measurement</strong> and is not an
            ASCVD percentage.
          </p>
        </div>
      </div>

      <div className="box" style={{ marginTop: 24 }}>
        <div className="bhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <TrendingUp size={16} /> Percentile comparison
          </span>
        </div>
        {percentiles.length === 0 ? (
          <div className="ins" style={{ borderBottom: "none" }}>
            <p>No comparable metrics yet. Resting heart rate, HRV, VO₂ max, and fasting glucose appear here once recorded.</p>
          </div>
        ) : (
          <div className="ins" style={{ borderBottom: "none" }}>
            {percentiles.map((p) => {
              const cls = pctClass(p.percentile, p.higherIsBetter);
              return (
                <div key={p.key} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                    <span style={{ fontSize: 14 }}>{p.display}</span>
                    <span className="muted" style={{ fontSize: 12.5 }}>
                      {p.value}
                      {p.unit ? ` ${p.unit}` : ""} · {p.percentile}th pct
                    </span>
                  </div>
                  <div
                    style={{
                      height: 8,
                      borderRadius: 999,
                      background: "var(--line, #e5e5e5)",
                      overflow: "hidden",
                    }}
                    aria-hidden
                  >
                    <div
                      className={`status ${cls}`}
                      style={{
                        width: `${p.percentile}%`,
                        height: "100%",
                        borderRadius: 999,
                        background: "currentColor",
                      }}
                    />
                  </div>
                  <p className="muted" style={{ fontSize: 12, marginTop: 5 }}>
                    {p.note} {p.higherIsBetter ? "Higher is generally better." : "Lower is generally preferable."}
                  </p>
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              Percentiles are <strong>illustrative — not a clinical or diagnostic measurement</strong> and use
              rough reference values, not validated population norms.
            </p>
          </div>
        )}
      </div>

      <div className="box" style={{ marginTop: 24 }}>
        <div className="bhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Info size={16} /> How your health age is computed
          </span>
        </div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <ul style={{ paddingLeft: 18, margin: 0, color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
            {methodology.map((m, i) => (
              <li key={i} style={{ marginBottom: 8 }}>{m}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <Activity />
        <span>
          We are not your healthcare provider and this is not a diagnosis. Discuss any cardiovascular concerns,
          cholesterol, or blood pressure with a licensed clinician. For anything urgent, call your local
          emergency number.
        </span>
      </div>
    </div>
  );
}
