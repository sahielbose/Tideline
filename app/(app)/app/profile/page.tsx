import { Info, ShieldCheck, ClipboardList } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getProfile } from "@/lib/services/profile";
import { SubmitButton } from "@/components/submit-button";
import { updateProfileAction } from "./actions";

// Match the .auth-form input look for textareas (no new global CSS).
const taStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 13px",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  resize: "vertical",
};

export default async function ProfilePage() {
  const user = await getSessionUser();
  const profile = await getProfile(user!.id);

  return (
    <div className="wrap" style={{ maxWidth: 760, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Health profile</h1>
          <p className="sub">
            Background you choose to record — conditions, allergies, family history, and goals.
          </p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          Informational only. This profile is context you record about yourself — Tideline does not
          diagnose, treat, or prescribe, and is not a substitute for a licensed clinician.
        </span>
      </div>

      <div className="box">
        <div className="bhead">
          <span>
            <ClipboardList style={{ verticalAlign: "-3px", marginRight: 8 }} size={16} />
            About you
          </span>
        </div>
        <form action={updateProfileAction} className="auth-form" style={{ padding: 18 }}>
          <label>
            Conditions
            <textarea
              name="conditions"
              rows={2}
              style={taStyle}
              placeholder="Comma-separated, e.g. Asthma, Hypothyroidism"
              defaultValue={profile.conditions.join(", ")}
            />
          </label>
          <label>
            Allergies
            <textarea
              name="allergies"
              rows={2}
              style={taStyle}
              placeholder="Comma-separated, e.g. Penicillin, Peanuts"
              defaultValue={profile.allergies.join(", ")}
            />
          </label>
          <label>
            Family history
            <textarea
              name="familyHistory"
              rows={2}
              style={taStyle}
              placeholder="Comma-separated, e.g. Type 2 diabetes, Heart disease"
              defaultValue={profile.familyHistory.join(", ")}
            />
          </label>
          <label>
            Goals
            <textarea
              name="goals"
              rows={2}
              style={taStyle}
              placeholder="Comma-separated, e.g. Sleep 8 hours, Lower resting heart rate"
              defaultValue={profile.goals.join(", ")}
            />
          </label>
          <label>
            Height (cm)
            <input
              name="heightCm"
              type="number"
              min={0}
              step="0.1"
              placeholder="Optional, e.g. 175"
              defaultValue={profile.heightCm ?? ""}
            />
          </label>
          <SubmitButton className="btn btn-primary" pendingLabel="Saving…">
            Save profile
          </SubmitButton>
        </form>
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ShieldCheck />
        <span>
          Tideline is informational and is not a licensed medical provider, doctor, or diagnostic
          service. Share these details with your clinician — keeping them here does not send them to
          anyone.
        </span>
      </div>
    </div>
  );
}
