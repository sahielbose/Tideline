import Link from "next/link";
import { Bell, BellOff, ShieldCheck, LogOut, Info } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { getIntegrationStatus } from "@/lib/settings";
import {
  setNotificationOptInAction,
  deleteDataAction,
  logoutAction,
} from "@/app/actions";
import { ActionButton } from "@/components/action-button";
import { ConfirmAction } from "@/components/confirm-action";
import { ExportButton } from "@/components/account/export-button";
import { IntegrationsSettings } from "./integrations";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const optedIn = user!.notifyOptIn;
  const integrations = await getIntegrationStatus();

  return (
    <div className="wrap" style={{ maxWidth: 760, marginBottom: 60 }}>
      <div className="page-head">
        <div>
          <h1 className="serif h1">Settings</h1>
          <p className="sub">Integrations, profile, notifications, and your data.</p>
        </div>
      </div>

      <h2 className="serif" style={{ fontSize: 19, margin: "4px 0 14px" }}>Integrations</h2>
      <IntegrationsSettings status={integrations} />

      <h2 className="serif" style={{ fontSize: 19, margin: "28px 0 14px" }}>Account</h2>

      <div className="box" style={{ marginBottom: 20 }}>
        <div className="bhead">Profile</div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <p style={{ marginBottom: 4 }}>
            <strong>{user!.name}</strong>
          </p>
          <p className="muted" style={{ fontSize: 14 }}>{user!.email}</p>
        </div>
      </div>

      <div className="box" style={{ marginBottom: 20 }}>
        <div className="bhead">
          Notifications
          <span className={`status ${optedIn ? "ok" : "info"}`}>
            <span className="dot" />
            {optedIn ? "Email on" : "Email off"}
          </span>
        </div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <p style={{ marginBottom: 12 }}>
            Get an email when an elevated insight appears and a weekly digest. Email is sent only
            after you opt in here. <Link href="/app/notifications" style={{ color: "var(--blue-ink)" }}>View notifications →</Link>
          </p>
          {optedIn ? (
            <ActionButton
              action={setNotificationOptInAction.bind(null, false, undefined)}
              className="btn btn-light"
              toast="Email notifications off"
            >
              <BellOff /> Turn off email notifications
            </ActionButton>
          ) : (
            <ConfirmAction
              action={setNotificationOptInAction.bind(null, true, user!.email)}
              triggerLabel={
                <>
                  <Bell /> Turn on email notifications
                </>
              }
              triggerClassName="btn btn-primary"
              title="Send health emails to this address?"
              description={`We'll email ${user!.email} when an elevated insight appears and once a week with a digest. You can turn this off anytime.`}
              confirmLabel="Opt in"
              successToast="Email notifications on"
            />
          )}
        </div>
      </div>

      <div className="box" style={{ marginBottom: 20 }}>
        <div className="bhead">Your data</div>
        <div className="ins" style={{ borderBottom: "none" }}>
          <p style={{ marginBottom: 14 }}>
            Export everything Tideline holds about you, or delete your account and all associated
            data.
          </p>
          <div className="acts" style={{ gap: 10, flexWrap: "wrap" }}>
            <Link className="btn btn-light" href="/app/report">
              Health report (PDF)
            </Link>
            <ExportButton />
            <ConfirmAction
              action={deleteDataAction}
              triggerLabel="Delete my data"
              triggerClassName="btn btn-light"
              title="Delete your account and all data?"
              description="This permanently removes your profile, observations, insights, labs, chats, and everything else. This cannot be undone."
              confirmLabel="Delete everything"
              destructive
              successToast="Your data was deleted"
            />
            <ActionButton action={logoutAction} className="btn btn-light" toast="Signed out">
              <LogOut /> Sign out
            </ActionButton>
          </div>
        </div>
      </div>

      <div className="disclaimer">
        <ShieldCheck />
        <span>
          Tideline is informational and is not a licensed medical provider, doctor, or diagnostic
          service. Always review insights with a licensed clinician.
        </span>
      </div>
      <p className="muted" style={{ fontSize: 12.5, marginTop: 14, display: "flex", gap: 6, alignItems: "center" }}>
        <Info size={14} /> Confirm-gated actions are recorded in an append-only audit log.
      </p>
    </div>
  );
}
