import Link from "next/link";
import { FlaskConical, Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listLabs, getLab } from "@/lib/services";
import { UploadLab } from "@/components/labs/upload-lab";

export default async function LabsPage() {
  const user = await getSessionUser();
  const labs = await listLabs(user!.id);
  const withCounts = await Promise.all(
    labs.map(async (l) => {
      const full = await getLab(user!.id, l.id);
      const markers = full?.markers ?? [];
      return { lab: l, total: markers.length, oor: markers.filter((m) => m.flag !== "in").length };
    }),
  );

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="serif h1">Labs</h1>
          <p className="sub">Your panels, explained marker by marker in plain English.</p>
        </div>
        <div className="head-actions" style={{ flexWrap: "wrap" }}>
          <UploadLab />
          <Link className="btn btn-light" href="/app/log">
            <Plus size={16} /> Add panel by hand
          </Link>
        </div>
      </div>

      {withCounts.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <FlaskConical />
          </div>
          <h2 className="serif h2">No labs yet</h2>
          <p>Upload a JSON, CSV, or PDF panel, or <Link href="/app/log" style={{ color: "var(--blue-ink)" }}>add a panel by hand</Link> to see the explainer.</p>
        </div>
      ) : (
        <div className="box" style={{ marginTop: 8, marginBottom: 60 }}>
          {withCounts.map(({ lab, total, oor }) => (
            <Link className="conn-item" href={`/app/labs/${lab.id}`} key={lab.id} style={{ padding: "16px 18px" }}>
              <span className="ic">
                <FlaskConical />
              </span>
              <div className="body">
                <div className="n">{lab.panelName}</div>
                <div className="s">
                  Collected {new Date(lab.collectedAt).toLocaleDateString()} · {total} markers
                </div>
              </div>
              <span className={`status ${oor > 0 ? "watch" : "ok"}`}>
                <span className="dot" />
                {oor > 0 ? `${oor} out of range` : "All in range"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
