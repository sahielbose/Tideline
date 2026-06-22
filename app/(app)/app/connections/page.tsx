import Link from "next/link";
import { FolderHeart, Heart, FlaskConical, RefreshCw, Download, Activity, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listConnections } from "@/lib/services";
import {
  syncDataAction,
  importRecordsAction,
  importWearableAction,
} from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { UploadFile } from "@/components/upload-file";
import { UploadLab } from "@/components/labs/upload-lab";
import { timeAgo } from "@/lib/utils";

const ICON = { records: FolderHeart, wearable: Heart, lab: FlaskConical } as const;

export default async function ConnectionsPage() {
  const user = await getSessionUser();
  const conns = await listConnections(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Connections</h1>
          <p className="sub">Import your records, wearables, and labs — or enter readings by hand.</p>
        </div>
        <div className="head-actions">
          <ActionButton action={syncDataAction} className="btn btn-light" toast="Synced your latest data" pendingLabel="Syncing…">
            <RefreshCw /> Sync all
          </ActionButton>
        </div>
      </div>

      <div className="cta-band" style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h2 className="serif h2" style={{ marginBottom: 4 }}>Prefer to type it in?</h2>
          <p className="muted" style={{ margin: 0 }}>Log readings and lab panels by hand — no files needed.</p>
        </div>
        <Link className="btn btn-primary" href="/app/log">
          <Activity /> Log data <ArrowRight size={16} />
        </Link>
      </div>

      <div className="box" style={{ marginBottom: 24 }}>
        <div className="bhead">Connected sources</div>
        {conns.length === 0 && (
          <div className="ins">
            <p>No sources connected yet. Import a file below, or <Link href="/app/log" style={{ color: "var(--blue-ink)" }}>log data by hand</Link>.</p>
          </div>
        )}
        {conns.map((c) => {
          const Icon = ICON[c.kind] ?? FolderHeart;
          return (
            <div className="conn-item" key={c.id} style={{ padding: "14px 18px" }}>
              <span className="ic">
                <Icon />
              </span>
              <div className="body">
                <div className="n">{c.label}</div>
                <div className="s">
                  {c.kind} · {c.adapter} · {c.lastSyncedAt ? `synced ${timeAgo(c.lastSyncedAt)}` : "not synced"}
                </div>
              </div>
              <span className="status ok">
                <span className="dot" />
                {c.status}
              </span>
            </div>
          );
        })}
      </div>

      <div className="cards-3">
        <div className="feature">
          <span className="ic">
            <FolderHeart />
          </span>
          <h3>Medical records</h3>
          <p>Import a FHIR R4 bundle (JSON) exported from your provider&apos;s patient portal.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <UploadFile action={importRecordsAction} accept=".json,application/json" label="Import FHIR bundle" toast="Importing records…" />
            <a className="conn-sample" href="/samples/fhir-bundle.json" download>
              <Download size={13} /> sample bundle
            </a>
          </div>
        </div>

        <div className="feature">
          <span className="ic">
            <Heart />
          </span>
          <h3>Wearable</h3>
          <p>Import an Apple Health export (XML) or a CSV, or log readings by hand.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <UploadFile action={importWearableAction} accept=".csv,.xml,text/csv,application/xml" label="Import export" toast="Importing wearable…" />
            <Link className="conn-sample" href="/app/log">
              <Activity size={13} /> log a reading
            </Link>
            <a className="conn-sample" href="/samples/wearable.csv" download>
              <Download size={13} /> sample CSV
            </a>
          </div>
        </div>

        <div className="feature">
          <span className="ic">
            <FlaskConical />
          </span>
          <h3>Labs</h3>
          <p>Upload a JSON, CSV, or PDF panel, or enter a panel marker by marker.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <UploadLab />
            <Link className="conn-sample" href="/app/log">
              <FlaskConical size={13} /> add a panel by hand
            </Link>
            <a className="conn-sample" href="/samples/lab-panel.json" download>
              <Download size={13} /> sample panel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
