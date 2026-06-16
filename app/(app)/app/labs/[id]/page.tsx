import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getLab } from "@/lib/services";
import { requestVisitAction } from "@/app/actions";
import { Markdown } from "@/components/markdown";
import { FlagForReview } from "@/components/flag-for-review";

const FLAG: Record<string, { cls: string; label: string }> = {
  in: { cls: "ok", label: "In range" },
  high: { cls: "elev", label: "High" },
  low: { cls: "watch", label: "Low" },
};

export default async function LabDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const data = await getLab(id);
  if (!data || data.lab.userId !== user!.id) notFound();
  const { lab, markers } = data;

  return (
    <div className="wrap" style={{ maxWidth: 900, marginBottom: 60 }}>
      <div style={{ paddingTop: 28 }}>
        <Link className="chip soft" href="/app/labs">
          <ArrowLeft /> All labs
        </Link>
      </div>

      <div className="page-head" style={{ paddingTop: 18 }}>
        <div>
          <h1 className="serif h2">{lab.panelName}</h1>
          <p className="sub">Collected {new Date(lab.collectedAt).toLocaleDateString()}</p>
        </div>
        <div className="head-actions">
          <FlagForReview action={requestVisitAction.bind(null, `Review: ${lab.panelName}`)} className="btn btn-light flag-btn" />
        </div>
      </div>

      <div className="box" style={{ overflow: "hidden" }}>
        <table className="lab-table">
          <thead>
            <tr>
              <th>Marker</th>
              <th>Value</th>
              <th>Reference</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {markers.map((m) => {
              const f = FLAG[m.flag] ?? FLAG.in;
              return (
                <tr key={m.id}>
                  <td>{m.display}</td>
                  <td>
                    <strong>{m.value}</strong> {m.unit}
                  </td>
                  <td className="muted">
                    {m.refLow != null && m.refHigh != null
                      ? `${m.refLow}–${m.refHigh} ${m.unit}`
                      : m.refHigh != null
                        ? `< ${m.refHigh} ${m.unit}`
                        : m.refLow != null
                          ? `> ${m.refLow} ${m.unit}`
                          : "—"}
                  </td>
                  <td>
                    <span className={`status ${f.cls}`}>
                      <span className="dot" />
                      {f.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {lab.explanationMd && (
        <div className="box" style={{ marginTop: 20 }}>
          <div className="bhead">
            Plain-English explanation
            <span className="count" style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <RefreshCw size={12} /> AI-generated
            </span>
          </div>
          <div className="ins" style={{ borderBottom: "none" }}>
            <Markdown content={lab.explanationMd} />
          </div>
        </div>
      )}
    </div>
  );
}
