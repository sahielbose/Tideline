import { ShieldAlert } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Privacy — Tideline" };

export default function PrivacyPage() {
  return (
    <>
      <div className="wrap prose-page">
        <h1 className="serif h1">Privacy</h1>
        <div className="disclaimer" style={{ margin: "16px 0 24px" }}>
          <ShieldAlert />
          <span>
            Tideline is informational and is <strong>not a licensed medical provider</strong> or
            diagnostic service. Health data is sensitive; we store only what is needed to run the
            monitoring features.
          </span>
        </div>
        <h2 className="serif">What we store</h2>
        <p>
          Your profile, the health observations you connect or import, the insights and baselines
          derived from them, your chats, and an append-only audit log of confirm-gated actions. In a
          self-hosted deployment, this all lives in your own Postgres database.
        </p>
        <h2 className="serif">What we do not do</h2>
        <ul>
          <li>We do not sell your data.</li>
          <li>We do not put health data in URLs or logs.</li>
          <li>We do not share your data with a clinician network — the reviewer is simulated.</li>
        </ul>
        <h2 className="serif">Your control</h2>
        <p>
          You can export everything Tideline holds about you as JSON, and you can delete your account
          and all associated data, at any time from Settings. Email notifications are sent only after
          you explicitly opt in.
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
