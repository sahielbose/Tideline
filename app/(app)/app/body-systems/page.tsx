import { HeartPulse, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getBodySystems } from "@/lib/services";
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/types";
import { MARKER_STATUS_CHIP } from "@/lib/lab-reference";

const BAR = (s: number) => (s >= 80 ? "#46A86B" : s >= 65 ? "#4C9AD0" : s >= 50 ? "#C99327" : "#C77A3C");

export default async function BodySystemsPage() {
  const user = await getSessionUser();
  const systems = await getBodySystems(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Body systems</h1>
          <p className="sub">Your markers grouped by system and scored against optimal ranges.</p>
        </div>
      </div>

      {systems.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <HeartPulse />
          </div>
          <h2 className="serif h2">Not enough data yet</h2>
          <p>Connect labs and a wearable to see your body-system scores.</p>
        </div>
      ) : (
        <div className="cards-3" style={{ marginTop: 8 }}>
          {systems.map((sys) => (
            <div className="box" key={sys.key}>
              <div className="bhead">
                {sys.label}
                <span className={`status ${STATUS_CLASS[sys.status]}`}>
                  <span className="dot" />
                  {STATUS_LABEL[sys.status]}
                </span>
              </div>
              <div className="ins" style={{ borderBottom: "none" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
                  <span className="serif" style={{ fontSize: 28, fontWeight: 650, color: BAR(sys.score) }}>{sys.score}</span>
                  <span className="muted" style={{ fontSize: 13 }}>/ 100</span>
                </div>
                <div style={{ height: 7, borderRadius: 999, background: "var(--line)", overflow: "hidden", marginBottom: 14 }}>
                  <div style={{ width: `${sys.score}%`, height: "100%", background: BAR(sys.score) }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {sys.markers.map((m) => {
                    const chip = MARKER_STATUS_CHIP[m.status];
                    return (
                      <div key={m.display} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13.5 }}>
                        <span>{m.display}</span>
                        <span className={`status ${chip.cls}`}>
                          <span className="dot" />
                          {m.status === "optimal" ? "Optimal" : m.status === "suboptimal" ? "Suboptimal" : chip.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ShieldCheck />
        <span>Body-system scores are an illustrative blend of your markers vs optimal ranges — not a clinical or diagnostic assessment.</span>
      </div>
    </div>
  );
}
