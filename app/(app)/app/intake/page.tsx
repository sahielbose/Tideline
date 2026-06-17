import { ClipboardList, Info, Stethoscope } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { BODY_REGIONS } from "@/lib/services/intake";
import { submitIntakeAction } from "@/app/(app)/app/intake/actions";
import { SubmitButton } from "@/components/submit-button";

const fieldStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 13px",
  fontSize: 15,
  outline: "none",
  background: "#fff",
  color: "var(--ink)",
};

const REGION_LABELS: Record<string, string> = {
  head: "Head",
  chest: "Chest",
  abdomen: "Abdomen",
  back: "Back",
  limbs: "Limbs",
  skin: "Skin",
  general: "General / whole body",
};

export default async function IntakePage() {
  const user = await getSessionUser();
  // Scoped read so the page renders per-user; no data is shown, just the form.
  void user!.id;

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Symptom intake</h1>
          <p className="sub">
            Describe what you&apos;re noticing. We&apos;ll organize it for a simulated review.
          </p>
          <p className="scope">
            This guided form is for <strong>triage and information only</strong> — it is not a
            diagnosis and not a substitute for a clinician. Submitting opens a flag in the{" "}
            <strong>simulated</strong> clinician queue, where an AI reviewer persona (clearly
            labeled, not a licensed clinician) drafts written guidance. For anything urgent or
            life-threatening, call your local emergency number.
          </p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          The severity scale below is illustrative — not a clinical or diagnostic measurement.
          Tideline is not a medical provider and never diagnoses or prescribes.
        </span>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1.4fr .9fr" }}>
        <div className="box">
          <div className="bhead">
            <span>
              <ClipboardList style={{ verticalAlign: "-3px", marginRight: 8 }} />
              What&apos;s going on?
            </span>
          </div>
          <form action={submitIntakeAction} className="auth-form" style={{ padding: 18 }}>
            <label>
              Main symptom
              <input
                name="symptom"
                type="text"
                placeholder="e.g. Sore throat"
                required
                maxLength={140}
              />
            </label>

            <label>
              Body region
              <select name="region" defaultValue="general" style={fieldStyle}>
                {BODY_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {REGION_LABELS[r] ?? r}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Onset — when did it start?
              <input name="onset" type="text" placeholder="e.g. 2 days ago" maxLength={120} />
            </label>

            <label>
              Duration — how long does it last?
              <input
                name="duration"
                type="text"
                placeholder="e.g. Constant, or comes and goes"
                maxLength={120}
              />
            </label>

            <label>
              Severity (1–10)
              <input name="severity" type="number" min={1} max={10} step={1} defaultValue={5} />
              <span style={{ fontSize: 12.5, color: "var(--muted-2)", fontWeight: 400 }}>
                Illustrative — not a clinical or diagnostic measurement.
              </span>
            </label>

            <label>
              Context — anything else worth noting?
              <textarea
                name="context"
                placeholder="e.g. Recent travel, known triggers, what helps or worsens it"
                rows={4}
                maxLength={800}
                style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit" }}
              />
            </label>

            <SubmitButton className="btn btn-primary" pendingLabel="Submitting…">
              Submit for simulated review
            </SubmitButton>
          </form>
        </div>

        <div className="box">
          <div className="bhead">
            <span>
              <Stethoscope style={{ verticalAlign: "-3px", marginRight: 8 }} />
              What happens next
            </span>
          </div>
          <div className="ins" style={{ borderBottom: "none" }}>
            <p style={{ marginBottom: 10 }}>
              Your intake is organized into a single review and sent to the{" "}
              <strong>simulated</strong> clinician queue.
            </p>
            <p style={{ marginBottom: 10 }}>
              An AI reviewer persona drafts conservative, written guidance — clearly labeled as a
              draft, not a real review.
            </p>
            <p style={{ marginBottom: 12 }}>
              You&apos;ll be taken to <strong>Doctor visits</strong> to read it and request a real
              clinician if you&apos;d like.
            </p>
            <span className="status info">
              <span className="dot" />
              Reviewer is simulated
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
