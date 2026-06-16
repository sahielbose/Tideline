import { Pill, Info } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listMedications } from "@/lib/services";
import { addMedicationAction } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { MedInfo } from "@/components/medications/med-info";

export default async function MedicationsPage() {
  const user = await getSessionUser();
  const meds = await listMedications(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Medications</h1>
          <p className="sub">A simple list of what you take, with reminders and general info.</p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          Tracking and information only. Tideline never prescribes, never changes doses, and is not a
          substitute for your prescriber or pharmacist.
        </span>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1.4fr .9fr" }}>
        <div className="box">
          <div className="bhead">Your medications</div>
          {meds.length === 0 && (
            <div className="ins">
              <p>No medications yet. Add one on the right.</p>
            </div>
          )}
          {meds.map((m) => (
            <div className="conn-item" key={m.id} style={{ padding: "14px 18px", alignItems: "flex-start" }}>
              <span className="ic">
                <Pill />
              </span>
              <div className="body">
                <div className="n">
                  {m.name} {m.dose ? <span className="muted">· {m.dose}</span> : null}
                </div>
                <div className="s">
                  {[m.schedule, m.notes].filter(Boolean).join(" · ") || "No schedule set"}
                </div>
                <MedInfo name={m.name} />
              </div>
              <span className={`status ${m.active ? "ok" : "info"}`}>
                <span className="dot" />
                {m.active ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>

        <div className="box">
          <div className="bhead">Add a medication</div>
          <form action={addMedicationAction} className="auth-form" style={{ padding: 18 }}>
            <label>
              Name
              <input name="name" type="text" placeholder="e.g. Lisinopril" required />
            </label>
            <label>
              Dose
              <input name="dose" type="text" placeholder="e.g. 10 mg" />
            </label>
            <label>
              Schedule
              <input name="schedule" type="text" placeholder="e.g. Once daily" />
            </label>
            <label>
              Notes
              <input name="notes" type="text" placeholder="Optional" />
            </label>
            <SubmitButton className="btn btn-primary" pendingLabel="Adding…">
              Add medication
            </SubmitButton>
          </form>
        </div>
      </div>
    </div>
  );
}
