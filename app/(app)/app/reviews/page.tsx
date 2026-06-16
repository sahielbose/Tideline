import { Stethoscope, Sparkles, MessageSquare, Pen, Clock, Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listReviewFlags } from "@/lib/services";
import { draftReviewAction, resolveReviewAction, requestVisitAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ConfirmAction } from "@/components/confirm-action";
import { Markdown } from "@/components/markdown";
import { timeAgo } from "@/lib/utils";

const STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  open: { cls: "watch", label: "Open" },
  in_review: { cls: "info", label: "In review (simulated)" },
  resolved: { cls: "ok", label: "Resolved" },
};

export default async function ReviewsPage() {
  const user = await getSessionUser();
  const flags = await listReviewFlags(user!.id);

  return (
    <div className="wrap">
      <div className="page-head">
        <div>
          <h1 className="serif h1">Doctor visits</h1>
          <p className="sub">Track your telehealth reviews and follow-ups.</p>
          <p className="scope">
            Our clinicians handle urgent, non-emergency concerns — colds, sinus or ear infections,
            flu, cough, sore throat, urinary symptoms, rashes, pink eye, and similar acute issues.
            Some types of care may fall outside this scope. For anything urgent or life-threatening,
            call your local emergency number. The reviewer here is <strong>simulated</strong> and
            clearly labeled.
          </p>
        </div>
        <div className="head-actions">
          <ConfirmAction
            action={requestVisitAction.bind(null, "New visit requested")}
            triggerLabel={
              <>
                <Plus /> New visit
              </>
            }
            triggerClassName="btn btn-dark"
            title="Request a visit?"
            description="This opens a review in the (simulated) clinician queue. No real appointment is booked and no payment is taken."
            confirmLabel="Request visit"
            successToast="Visit requested"
          />
        </div>
      </div>

      {flags.length === 0 ? (
        <div className="empty">
          <div className="badge-ic">
            <Stethoscope />
            <span className="sparkle">
              <Sparkles />
            </span>
          </div>
          <h2 className="serif h2">No visits yet</h2>
          <p>
            Flag an insight or ask the AI doctor to request a review. A simulated clinician will draft
            written guidance and next steps.
          </p>
          <div className="row">
            <span className="chip">
              <MessageSquare /> Async messaging
            </span>
            <span className="chip">
              <Pen /> Written guidance
            </span>
            <span className="chip">
              <Clock /> Quick responses
            </span>
          </div>
          <ConfirmAction
            action={requestVisitAction.bind(null, "First visit requested")}
            triggerLabel="Start your first visit"
            triggerClassName="btn btn-dark"
            title="Request a visit?"
            description="This opens a review in the simulated clinician queue. No real appointment is booked and no payment is taken."
            confirmLabel="Request visit"
            successToast="Visit requested"
          />
        </div>
      ) : (
        <div className="panel" style={{ marginTop: 24, marginBottom: 60 }}>
          {flags.map((f) => {
            const ctx = f.context as Record<string, unknown>;
            const chip = STATUS_CHIP[f.status] ?? STATUS_CHIP.open;
            return (
              <div className="box" key={f.id}>
                <div className="bhead">
                  <span>{String(ctx.summary ?? ctx.title ?? "Review request")}</span>
                  <span className={`status ${chip.cls}`}>
                    <span className="dot" />
                    {chip.label}
                  </span>
                </div>
                <div className="ins" style={{ borderBottom: "none" }}>
                  <p style={{ marginBottom: 10 }}>
                    {String(ctx.details ?? "Flagged for clinician review.")}
                  </p>
                  <p className="meta" style={{ fontSize: 12.5, color: "var(--muted-2)", marginBottom: 12 }}>
                    From {f.source} · opened {timeAgo(f.createdAt)}
                  </p>
                  {f.reviewerNoteMd && (
                    <div className="disclaimer" style={{ marginBottom: 14, display: "block" }}>
                      <Markdown content={f.reviewerNoteMd} />
                    </div>
                  )}
                  <div className="acts">
                    {f.status !== "resolved" && (
                      <ActionButton
                        action={draftReviewAction.bind(null, f.id)}
                        className="mini-btn"
                        toast="Simulated review drafted"
                        pendingLabel="Drafting…"
                      >
                        {f.reviewerNoteMd ? "Regenerate simulated review" : "Generate simulated review"}
                      </ActionButton>
                    )}
                    {f.status !== "resolved" && (
                      <ConfirmAction
                        action={resolveReviewAction.bind(null, f.id)}
                        triggerLabel="Resolve"
                        triggerClassName="mini-btn"
                        title="Resolve this review?"
                        description="Mark this review as resolved. You can still see it in your history."
                        confirmLabel="Resolve"
                        successToast="Review resolved"
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
