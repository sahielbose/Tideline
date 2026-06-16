import { Check, X, ClipboardCheck, ShieldAlert } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getRiskPanel, getCareGaps } from "@/lib/services";

const BAND_CHIP = {
  favorable: { cls: "ok", label: "Favorable" },
  watch: { cls: "watch", label: "Watch" },
  elevated: { cls: "elev", label: "Elevated" },
} as const;

const GAP_CHIP = {
  overdue: { cls: "elev", label: "Overdue" },
  due: { cls: "watch", label: "Due" },
  ok: { cls: "ok", label: "Up to date" },
} as const;

export default async function RiskPage() {
  const user = await getSessionUser();
  const [risk, gaps] = await Promise.all([getRiskPanel(user!.id), getCareGaps(user!.id)]);
  const ms = risk.metabolicSyndrome;
  const cm = risk.cardiometabolic;

  return (
    <div className="wrap" style={{ maxWidth: 880, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Risk &amp; screening</h1>
          <p className="sub">Illustrative screening summaries from your data — not diagnoses.</p>
        </div>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="box">
          <div className="bhead">
            Metabolic syndrome screen
            <span className={`status ${ms.meets ? "elev" : "ok"}`}>
              <span className="dot" />
              {ms.criteriaMet}/{ms.total} criteria
            </span>
          </div>
          <div className="ins" style={{ borderBottom: "none" }}>
            {ms.criteria.map((c) => (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ color: c.met ? "var(--elev-tx)" : "var(--ok-tx)", display: "grid", placeItems: "center" }}>
                  {c.met ? <X size={16} /> : <Check size={16} />}
                </span>
                <span style={{ flex: 1, fontSize: 14 }}>{c.name}</span>
                <span className="muted" style={{ fontSize: 12.5 }}>{c.detail}</span>
              </div>
            ))}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{ms.note}</p>
          </div>
        </div>

        <div className="box">
          <div className="bhead">
            Cardiometabolic
            <span className={`status ${BAND_CHIP[cm.band].cls}`}>
              <span className="dot" />
              {BAND_CHIP[cm.band].label}
            </span>
          </div>
          <div className="ins" style={{ borderBottom: "none" }}>
            <p style={{ marginBottom: 10 }}>
              <strong>{cm.outOfOptimal}</strong> cardiometabolic marker{cm.outOfOptimal === 1 ? "" : "s"} outside their optimal range.
            </p>
            {cm.drivers.length > 0 && (
              <ul style={{ paddingLeft: 18, margin: "0 0 10px", color: "var(--muted)", fontSize: 14 }}>
                {cm.drivers.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            )}
            <p className="muted" style={{ fontSize: 12.5 }}>{cm.note}</p>
          </div>
        </div>
      </div>

      <div className="box" style={{ marginTop: 24 }}>
        <div className="bhead">
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={16} /> Preventive care &amp; screening
          </span>
        </div>
        {gaps.length === 0 ? (
          <div className="ins"><p>Add your date of birth in settings to see age/sex-based screening suggestions.</p></div>
        ) : (
          gaps.map((g) => (
            <div className="conn-item" key={g.key} style={{ padding: "13px 18px" }}>
              <div className="body">
                <div className="n">{g.name}</div>
                <div className="s">{g.detail}</div>
              </div>
              <span className={`status ${GAP_CHIP[g.status].cls}`}>
                <span className="dot" />
                {GAP_CHIP[g.status].label}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ShieldAlert />
        <span>These are general, illustrative screening summaries — commonly recommended, not personalized medical advice. Discuss timing and results with a licensed clinician.</span>
      </div>
    </div>
  );
}
