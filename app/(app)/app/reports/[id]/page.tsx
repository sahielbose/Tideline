import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getSnapshot } from "@/lib/services/reports";
import type { SnapshotData } from "@/lib/services/reports";

export const metadata = { title: "Snapshot — Tideline" };

const BAND_CHIP: Record<string, { cls: string; label: string }> = {
  favorable: { cls: "ok", label: "Favorable" },
  watch: { cls: "watch", label: "Watch" },
  elevated: { cls: "elev", label: "Elevated" },
};

const INDEX_CHIP = (index: number): { cls: string; label: string } =>
  index >= 80
    ? { cls: "ok", label: "Excellent" }
    : index >= 65
      ? { cls: "info", label: "Good" }
      : index >= 50
        ? { cls: "watch", label: "Fair" }
        : { cls: "elev", label: "Needs attention" };

export default async function SnapshotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const snapshot = await getSnapshot(user!.id, id);
  if (!snapshot) notFound();

  const data = snapshot.data as unknown as SnapshotData;
  const hi = data.healthIndex;
  const idx = hi?.index ?? 0;
  const idxChip = INDEX_CHIP(idx);
  const cm = data.risk?.cardiometabolic;
  const ms = data.risk?.metabolicSyndrome;
  const bandChip = cm?.band ? BAND_CHIP[cm.band] : null;
  const metrics = data.metrics ?? [];

  return (
    <div className="wrap" style={{ maxWidth: 900, marginBottom: 60 }}>
      <div style={{ paddingTop: 28 }}>
        <Link className="chip soft" href="/app/reports">
          <ArrowLeft /> All snapshots
        </Link>
      </div>

      <div className="page-head" style={{ paddingTop: 18 }}>
        <div>
          <h1 className="serif h2">{snapshot.label}</h1>
          <p className="sub">
            Captured {new Date(snapshot.createdAt).toLocaleString()} · a stored, point-in-time copy
          </p>
        </div>
        {hi && (
          <div className="head-actions">
            <span className={`status ${idxChip.cls}`}>
              <span className="dot" />
              {idxChip.label}
            </span>
          </div>
        )}
      </div>

      <p className="disclaimer" style={{ display: "block" }}>
        {data.disclaimer ??
          "Illustrative — not a clinical or diagnostic measurement. Not a substitute for a licensed provider."}
      </p>

      <div className="metrics" style={{ marginTop: 20 }}>
        <div className="mcard">
          <div className="s">Health index</div>
          <div className="n">{idx}/100</div>
          <div className="s">{hi?.label ?? "—"}</div>
        </div>
        {hi?.healthAge != null && (
          <div className="mcard">
            <div className="s">Illustrative health age</div>
            <div className="n">{hi.healthAge}</div>
            <div className="s">illustrative only</div>
          </div>
        )}
        {cm && (
          <div className="mcard">
            <div className="s">Cardiometabolic band</div>
            <div className="n" style={{ fontSize: 20 }}>
              {bandChip?.label ?? cm.band}
            </div>
            <div className="s">{cm.outOfOptimal} marker(s) outside optimal</div>
          </div>
        )}
        {ms && (
          <div className="mcard">
            <div className="s">Metabolic screening</div>
            <div className="n">
              {ms.criteriaMet}/{ms.total}
            </div>
            <div className="s">criteria met (screening, not a diagnosis)</div>
          </div>
        )}
      </div>

      {hi?.note && (
        <p className="disclaimer" style={{ display: "block", marginTop: 16 }}>
          {hi.note}
        </p>
      )}

      {cm && cm.drivers.length > 0 && (
        <div className="box" style={{ marginTop: 20 }}>
          <div className="bhead">Cardiometabolic drivers (illustrative)</div>
          <div className="ins" style={{ borderBottom: "none" }}>
            <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
              {cm.drivers.map((d) => (
                <span className="chip" key={d}>
                  {d}
                </span>
              ))}
            </div>
            {data.risk?.note && (
              <p className="meta" style={{ fontSize: 12.5, color: "var(--muted-2)", marginTop: 12 }}>
                {data.risk.note}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="box" style={{ marginTop: 20, overflow: "hidden" }}>
        <div className="bhead">Latest readings at capture</div>
        {metrics.length === 0 ? (
          <div className="ins" style={{ borderBottom: "none" }}>
            <p className="empty" style={{ margin: 0 }}>
              No metric readings were available when this snapshot was taken.
            </p>
          </div>
        ) : (
          <table className="lab-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Value</th>
                <th>As of</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.code}>
                  <td>{m.code}</td>
                  <td>
                    <strong>{m.value}</strong> {m.unit ?? ""}
                  </td>
                  <td className="muted">{new Date(m.at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
