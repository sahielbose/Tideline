import { CalendarRange } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listPrograms } from "@/lib/services/programs";
import { ProgramCard } from "@/components/programs/program-card";

export default async function ProgramsPage() {
  const user = await getSessionUser();
  const programs = await listPrograms(user!.id);

  const active = programs.filter((p) => p.enrolled && !p.completed).length;
  const completed = programs.filter((p) => p.completed).length;

  return (
    <div className="wrap" style={{ maxWidth: 880, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Programs</h1>
          <p className="sub">
            Multi-week lifestyle routines you can follow at your own pace
            {programs.length > 0 ? ` · ${active} in progress · ${completed} completed` : ""}.
          </p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginBottom: 18, display: "block" }}>
        These programs are <strong>illustrative — not a clinical or diagnostic measurement</strong> and
        not personalized to you. They offer gentle, general-wellness lifestyle steps only — never a
        diagnosis, treatment, or prescription. Tideline is not a medical provider; talk with a
        qualified clinician before changing anything about your health routine.
      </div>

      {programs.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <CalendarRange />
          </div>
          <h2 className="serif h2">No programs available</h2>
          <p>Check back soon for illustrative multi-week lifestyle routines.</p>
        </div>
      ) : (
        <div style={{ marginTop: 8 }}>
          {programs.map((p) => (
            <ProgramCard
              key={p.def.key}
              programKey={p.def.key}
              title={p.def.title}
              weeks={p.def.weeks}
              goal={p.def.goal}
              steps={p.def.steps}
              enrolled={p.enrolled}
              completed={p.completed}
              completedSteps={p.completedSteps}
              progressPct={p.progressPct}
            />
          ))}
        </div>
      )}
    </div>
  );
}
