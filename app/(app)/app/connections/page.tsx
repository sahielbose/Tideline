import { FolderHeart, Heart, FlaskConical, RefreshCw, Sparkles, Download } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listConnections } from "@/lib/services";
import {
  connectAction,
  syncDataAction,
  loadDemoLabAction,
  importRecordsAction,
  importWearableAction,
} from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { UploadFile } from "@/components/upload-file";
import { UploadLab } from "@/components/labs/upload-lab";
import { timeAgo } from "@/lib/utils";

const ICON = { records: FolderHeart, wearable: Heart, lab: FlaskConical } as const;
const RECORD_ORGS = ["Acme Health", "Kaiser Permanente", "Optum", "St Luke's", "UPMC", "Vanderbilt"];
const WEARABLES = ["Fitbit", "Garmin", "Oura", "Dexcom", "Omron", "Strava"];

export default async function ConnectionsPage() {
  const user = await getSessionUser();
  const conns = await listConnections(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Connections</h1>
          <p className="sub">Records, wearables, and labs — connect demo data or import your own files.</p>
        </div>
        <div className="head-actions">
          <ActionButton action={syncDataAction} className="btn btn-light" toast="Synced your latest data" pendingLabel="Syncing…">
            <RefreshCw /> Sync all
          </ActionButton>
        </div>
      </div>

      <div className="box" style={{ marginBottom: 24 }}>
        <div className="bhead">Connected sources</div>
        {conns.length === 0 && (
          <div className="ins">
            <p>No sources connected yet. Add one below.</p>
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
          <p>Connect demo records, or import a FHIR R4 bundle (JSON).</p>
          <div className="logo-row" style={{ justifyContent: "flex-start", gap: 16, opacity: 0.55, margin: "12px 0 16px" }}>
            {RECORD_ORGS.slice(0, 4).map((o) => (
              <span key={o}>{o}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ActionButton action={connectAction.bind(null, "records", "mock")} className="btn btn-primary" toast="Records connected" pendingLabel="Connecting…">
              Connect demo records
            </ActionButton>
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
          <p>Sync demo biometrics, or import an Apple Health export (XML) or CSV.</p>
          <div className="logo-row" style={{ justifyContent: "flex-start", gap: 16, opacity: 0.55, margin: "12px 0 16px" }}>
            {WEARABLES.slice(0, 4).map((o) => (
              <span key={o}>{o}</span>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ActionButton action={connectAction.bind(null, "wearable", "mock")} className="btn btn-primary" toast="Wearable connected" pendingLabel="Connecting…">
              Connect demo wearable
            </ActionButton>
            <UploadFile action={importWearableAction} accept=".csv,.xml,text/csv,application/xml" label="Import export" toast="Importing wearable…" />
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
          <p>Upload a JSON, CSV, or PDF panel, or load a demo lab.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <UploadLab />
            <ActionButton action={loadDemoLabAction} className="btn btn-light" toast="Loaded a demo panel">
              <Sparkles /> Load demo lab
            </ActionButton>
            <a className="conn-sample" href="/samples/lab-panel.json" download>
              <Download size={13} /> sample panel
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
