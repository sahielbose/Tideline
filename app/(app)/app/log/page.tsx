import { Info, ShieldCheck, Trash2 } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { METRICS } from "@/lib/metrics";
import { resetHealthDataAction } from "@/app/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { LogReadingForm } from "./log-reading-form";
import { AddLabForm } from "./add-lab-form";

export default async function LogPage() {
  await getSessionUser();

  // Individual metrics, minus the BP pair (the form offers a combined entry).
  const metrics = Object.values(METRICS)
    .filter((m) => m.key !== "bp_systolic" && m.key !== "bp_diastolic")
    .map((m) => ({
      key: m.key,
      display: m.display,
      unit: m.unit,
      refLow: m.refLow,
      refHigh: m.refHigh,
    }));

  return (
    <div className="wrap" style={{ maxWidth: 820, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Log your data</h1>
          <p className="sub">Type in your own readings and lab results — nothing here is mocked.</p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          Everything you enter is your own data. It feeds the dashboard, trends, drift monitoring,
          and the AI doctor. Informational only — not a diagnosis.
        </span>
      </div>

      <LogReadingForm metrics={metrics} />
      <AddLabForm />

      <div className="box" style={{ marginTop: 4 }}>
        <div className="bhead">Start fresh</div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <p style={{ marginBottom: 14 }}>
            Clear out any demo or previously-loaded data — observations, labs, connections,
            insights, and baselines — so you begin from a clean slate. Your account, profile,
            medications, journal, and chats are kept.
          </p>
          <ConfirmAction
            action={resetHealthDataAction}
            triggerLabel={
              <>
                <Trash2 size={15} /> Clear all health data
              </>
            }
            triggerClassName="btn btn-light"
            title="Clear all health data?"
            description="This removes observations, labs, connections, drift signals, insights, and baselines for your account. Your profile, medications, journal, habits, and chats are kept. This cannot be undone."
            confirmLabel="Clear data"
            destructive
            successToast="Health data cleared"
          />
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 20 }}>
        <ShieldCheck />
        <span>
          Tideline is informational and is not a licensed medical provider, doctor, or diagnostic
          service. Always review insights with a licensed clinician.
        </span>
      </div>
    </div>
  );
}
