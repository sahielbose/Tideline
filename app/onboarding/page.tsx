import Link from "next/link";
import { redirect } from "next/navigation";
import { FolderHeart, Heart, FlaskConical, Sparkles, ArrowRight } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";
import { connectAction, loadDemoLabAction, seedDemoForCurrentUserAction } from "@/app/actions";
import { ActionButton } from "@/components/action-button";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <>
      <TopNav userInitial={(user.name?.[0] ?? "D").toUpperCase()} />
      <main>
        <div className="wrap" style={{ maxWidth: 820, paddingBottom: 60 }}>
          <div className="hero" style={{ padding: "56px 0 24px", textAlign: "center" }}>
            <h1 className="serif h1">Let&apos;s build your timeline</h1>
            <p className="lead" style={{ maxWidth: 540, margin: "12px auto 0" }}>
              Connect a source to start monitoring — or load the full demo dataset to see everything
              at once.
            </p>
          </div>

          <div className="cta-band" style={{ marginBottom: 28 }}>
            <h2 className="serif h2">Just exploring?</h2>
            <p className="muted" style={{ margin: "8px 0 18px" }}>
              Load a realistic demo: records, a wearable with a few weeks of drift, and labs.
            </p>
            <ActionButton
              action={seedDemoForCurrentUserAction}
              className="btn btn-primary"
              toast="Loading demo data…"
              pendingLabel="Loading…"
            >
              <Sparkles /> Load demo data
            </ActionButton>
          </div>

          <div className="cards-3">
            <div className="feature">
              <span className="ic">
                <FolderHeart />
              </span>
              <h3>Records</h3>
              <p>Bring in conditions, encounters, and history.</p>
              <ActionButton action={connectAction.bind(null, "records", "mock")} className="btn btn-light" toast="Records connected" pendingLabel="Connecting…">
                Connect records
              </ActionButton>
            </div>
            <div className="feature">
              <span className="ic">
                <Heart />
              </span>
              <h3>Wearable</h3>
              <p>Resting HR, HRV, sleep, SpO₂, steps, and more.</p>
              <ActionButton action={connectAction.bind(null, "wearable", "mock")} className="btn btn-light" toast="Wearable connected" pendingLabel="Connecting…">
                Connect wearable
              </ActionButton>
            </div>
            <div className="feature">
              <span className="ic">
                <FlaskConical />
              </span>
              <h3>Labs</h3>
              <p>Load a demo panel to see the explainer.</p>
              <ActionButton action={loadDemoLabAction} className="btn btn-light" toast="Loaded a demo panel">
                Load demo lab
              </ActionButton>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 30 }}>
            <Link className="btn btn-dark" href="/app">
              Go to dashboard <ArrowRight />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
