import Link from "next/link";
import { FileText, Sparkles, Camera, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listSnapshots } from "@/lib/services/reports";
import { ActionButton } from "@/components/action-button";
import { timeAgo } from "@/lib/utils";
import { saveSnapshotAction } from "./actions";
import type { SnapshotData } from "@/lib/services/reports";

export const metadata = { title: "Saved snapshots — Tideline" };

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

export default async function ReportsPage() {
  const user = await getSessionUser();
  const snapshots = await listSnapshots(user!.id);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="serif h1">Saved snapshots</h1>
          <p className="sub">Capture a point-in-time copy of your health summary to revisit later.</p>
        </div>
        <div className="head-actions">
          <ActionButton
            action={saveSnapshotAction}
            className="btn btn-primary"
            toast="Snapshot saved"
            pendingLabel="Saving…"
          >
            <Camera /> Save current snapshot
          </ActionButton>
        </div>
      </div>

      <p className="disclaimer" style={{ marginTop: 16, display: "block" }}>
        Each snapshot stores illustrative figures — not a clinical or diagnostic measurement. This is
        not a substitute for a licensed provider.
      </p>

      {snapshots.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <FileText />
            <span className="sparkle">
              <Sparkles />
            </span>
          </div>
          <h2 className="serif h2">No snapshots yet</h2>
          <p>
            Save a snapshot to keep a dated copy of your headline health index, illustrative risk
            bands, and latest readings. Snapshots never change once saved.
          </p>
          <ActionButton
            action={saveSnapshotAction}
            className="btn btn-dark"
            toast="Snapshot saved"
            pendingLabel="Saving…"
          >
            <Camera /> Save your first snapshot
          </ActionButton>
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 24, marginBottom: 60 }}>
          {snapshots.map((s) => {
            const data = s.data as unknown as SnapshotData;
            const idx = data.healthIndex?.index ?? 0;
            const idxChip = INDEX_CHIP(idx);
            const band = data.risk?.cardiometabolic?.band;
            const bandChip = band ? BAND_CHIP[band] : null;
            return (
              <Link className="conn-item" key={s.id} href={`/app/reports/${s.id}`}>
                <div className="ic">
                  <FileText />
                </div>
                <div className="body">
                  <div className="n">{s.label}</div>
                  <div className="s">
                    Health index {idx}/100 · {data.healthIndex?.label ?? "—"}
                    {bandChip ? ` · cardiometabolic ${bandChip.label.toLowerCase()}` : ""} · saved{" "}
                    {timeAgo(s.createdAt)}
                  </div>
                </div>
                <span className={`status ${idxChip.cls}`}>
                  <span className="dot" />
                  {idxChip.label}
                </span>
                <ArrowRight size={16} style={{ color: "var(--muted-2)", marginLeft: 10 }} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
