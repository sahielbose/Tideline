import { Pill, Info, CalendarPlus, RefreshCw } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getAdherence, ADHERENCE_WINDOW_DAYS } from "@/lib/services/adherence";
import { requestRefillAction, requestAppointmentAction } from "@/app/(app)/app/adherence/actions";
import { ConfirmAction } from "@/components/confirm-action";
import { SubmitButton } from "@/components/submit-button";
import { LogDoseButton } from "@/components/adherence/log-dose-button";
import { timeAgo } from "@/lib/utils";

/** Map an illustrative adherence percentage to a status chip class. */
function adherenceChip(percent: number): { cls: string; label: string } {
  if (percent >= 80) return { cls: "ok", label: `${percent}% logged` };
  if (percent >= 50) return { cls: "watch", label: `${percent}% logged` };
  return { cls: "elev", label: `${percent}% logged` };
}

export default async function AdherencePage() {
  const user = await getSessionUser();
  const rows = await getAdherence(user!.id);

  return (
    <div className="wrap" style={{ marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Adherence</h1>
          <p className="sub">
            Log your doses and keep an illustrative view of how consistently you take each medication.
          </p>
        </div>
      </div>

      <div className="disclaimer" style={{ marginTop: 4, marginBottom: 20 }}>
        <Info />
        <span>
          Tracking only. <strong>Tideline never prescribes or changes doses.</strong> The adherence
          percentage is <strong>illustrative — not a clinical or diagnostic measurement</strong>{" "}
          (assumes a once-daily target over the last {ADHERENCE_WINDOW_DAYS} days). Refill and
          appointment requests below are <strong>mocked</strong> and go to the simulated review queue —
          no pharmacy is contacted, no appointment is booked, and no payment is taken.
        </span>
      </div>

      <div className="dash-grid" style={{ gridTemplateColumns: "1.4fr .9fr" }}>
        <div className="box">
          <div className="bhead">Active medications · last {ADHERENCE_WINDOW_DAYS} days</div>
          {rows.length === 0 ? (
            <div className="ins">
              <p>
                No active medications yet. Add medications under Medications, then come back here to
                log doses.
              </p>
            </div>
          ) : (
            rows.map((r) => {
              const chip = adherenceChip(r.percent);
              return (
                <div
                  className="conn-item"
                  key={r.medication.id}
                  style={{ padding: "14px 18px", alignItems: "flex-start" }}
                >
                  <span className="ic">
                    <Pill />
                  </span>
                  <div className="body">
                    <div className="n">
                      {r.medication.name}{" "}
                      {r.medication.dose ? (
                        <span className="muted">· {r.medication.dose}</span>
                      ) : null}
                    </div>
                    <div className="s">
                      {r.doses7d} of {r.target} doses logged ·{" "}
                      {r.lastTakenAt ? `last ${timeAgo(r.lastTakenAt)}` : "no doses logged yet"}
                    </div>
                    <div className="acts" style={{ marginTop: 8 }}>
                      <LogDoseButton medicationId={r.medication.id} />
                      <ConfirmAction
                        action={requestRefillAction.bind(null, r.medication.id)}
                        triggerLabel={
                          <>
                            <RefreshCw /> Request refill
                          </>
                        }
                        triggerClassName="mini-btn"
                        title="Request a refill?"
                        description="This opens a mocked refill request in the simulated review queue. Tideline does not prescribe or contact any pharmacy."
                        confirmLabel="Request refill"
                        successToast="Refill requested (simulated)"
                      />
                    </div>
                  </div>
                  <span className={`status ${chip.cls}`}>
                    <span className="dot" />
                    {chip.label}
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="box">
          <div className="bhead">
            <CalendarPlus style={{ width: 16, height: 16 }} /> Request an appointment
          </div>
          <form
            action={requestAppointmentAction.bind(null, "appointment")}
            className="auth-form"
            style={{ padding: 18 }}
          >
            <label>
              What would you like to discuss?
              <input name="reason" type="text" placeholder="e.g. Review my blood pressure meds" />
            </label>
            <SubmitButton className="btn btn-primary" pendingLabel="Requesting…">
              Request appointment
            </SubmitButton>
            <p className="disclaimer" style={{ marginTop: 12, display: "block" }}>
              Simulated request only. No real appointment is booked, no payment is taken, and the
              reviewer is simulated and clearly labeled. For anything urgent or life-threatening, call
              your local emergency number.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
