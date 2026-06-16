import { getSessionUser } from "@/lib/auth";
import { getDashboard, getBiomarkers, listMedications, getRiskPanel } from "@/lib/services";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { MARKER_STATUS_CHIP } from "@/lib/lab-reference";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Health report — Tideline" };

export default async function ReportPage() {
  const user = await getSessionUser();
  const [dash, biomarkers, meds, risk] = await Promise.all([
    getDashboard(user!.id),
    getBiomarkers(user!.id),
    listMedications(user!.id),
    getRiskPanel(user!.id),
  ]);
  const activeMeds = meds.filter((m) => m.active);
  const insights = dash.insights.filter((i) => i.status !== "resolved");

  return (
    <div className="wrap report" style={{ maxWidth: 820, marginBottom: 60 }}>
      <div className="page-head" style={{ alignItems: "center" }}>
        <div>
          <h1 className="serif h1">Health report</h1>
          <p className="sub">
            {user!.name} · generated {new Date().toLocaleDateString()}
          </p>
        </div>
        <div className="head-actions">
          <PrintButton />
        </div>
      </div>

      <div className="disclaimer" style={{ marginBottom: 20 }}>
        <span>
          Prepared by Tideline (informational, not a licensed medical provider). Figures marked
          illustrative are not validated clinical measurements. Review with a clinician.
        </span>
      </div>

      <section className="report-sec">
        <h2 className="serif">Summary</h2>
        <p>
          Health index <strong>{dash.healthIndex.index}/100</strong> ({dash.healthIndex.label})
          {dash.healthIndex.healthAge != null ? `, illustrative health age ${dash.healthIndex.healthAge}` : ""}.
          {dash.readiness.available >= 2 ? ` Daily readiness ${dash.readiness.score}/100 (${dash.readiness.label}).` : ""}
          {" "}Cardiometabolic band: <strong>{risk.cardiometabolic.band}</strong>; metabolic-syndrome
          criteria met {risk.metabolicSyndrome.criteriaMet}/{risk.metabolicSyndrome.total}.
        </p>
      </section>

      <section className="report-sec">
        <h2 className="serif">Metrics</h2>
        <table className="lab-table">
          <thead>
            <tr><th>Metric</th><th>Latest</th><th>Baseline</th><th>Status</th></tr>
          </thead>
          <tbody>
            {dash.cards.map((c) => (
              <tr key={c.key}>
                <td>{c.display}</td>
                <td><strong>{c.value}</strong> {c.unit}</td>
                <td className="muted">{c.baseline}</td>
                <td>{STATUS_LABEL[c.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {insights.length > 0 && (
        <section className="report-sec">
          <h2 className="serif">Active insights</h2>
          <ul>
            {insights.map((i) => (
              <li key={i.id}>
                <strong>[{STATUS_LABEL[i.severity]}]</strong> {i.title} — {i.recommendedAction}
              </li>
            ))}
          </ul>
        </section>
      )}

      {biomarkers.length > 0 && (
        <section className="report-sec">
          <h2 className="serif">Labs / biomarkers</h2>
          <table className="lab-table">
            <thead>
              <tr><th>Marker</th><th>Latest</th><th>Reference</th><th>Status</th></tr>
            </thead>
            <tbody>
              {biomarkers.map((m) => (
                <tr key={m.code}>
                  <td>{m.display}</td>
                  <td><strong>{m.latest}</strong> {m.unit}</td>
                  <td className="muted">{m.refLow != null && m.refHigh != null ? `${m.refLow}–${m.refHigh}` : "—"}</td>
                  <td>{m.status === "optimal" ? "Optimal" : m.status === "suboptimal" ? "Suboptimal" : MARKER_STATUS_CHIP[m.status].label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="report-sec">
        <h2 className="serif">Medications</h2>
        {activeMeds.length === 0 ? (
          <p className="muted">None recorded.</p>
        ) : (
          <ul>
            {activeMeds.map((m) => (
              <li key={m.id}>
                {m.name}
                {m.dose ? ` — ${m.dose}` : ""}
                {m.schedule ? ` (${m.schedule})` : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
