import Link from "next/link";
import { redirect } from "next/navigation";
import { Activity, Upload, FlaskConical, ArrowRight, ClipboardList } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { TopNav } from "@/components/top-nav";

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
            <p className="lead" style={{ maxWidth: 560, margin: "12px auto 0" }}>
              Add your own data to start monitoring — type in readings and labs, or import an export
              from your records or wearable. It&apos;s all yours, nothing is mocked.
            </p>
          </div>

          <div className="cta-band" style={{ marginBottom: 28 }}>
            <h2 className="serif h2">Enter your first reading</h2>
            <p className="muted" style={{ margin: "8px 0 18px" }}>
              Log a resting heart rate, blood pressure, weight, glucose, sleep — anything you track.
            </p>
            <Link className="btn btn-primary" href="/app/log">
              <Activity /> Log your data
            </Link>
          </div>

          <div className="cards-3">
            <div className="feature">
              <span className="ic">
                <Activity />
              </span>
              <h3>Readings</h3>
              <p>Type in vitals and biometrics: HR, HRV, BP, sleep, SpO₂, glucose, weight, and more.</p>
              <Link className="btn btn-light" href="/app/log">
                Log readings
              </Link>
            </div>
            <div className="feature">
              <span className="ic">
                <FlaskConical />
              </span>
              <h3>Labs</h3>
              <p>Enter a panel marker by marker, or upload a JSON, CSV, or PDF report.</p>
              <Link className="btn btn-light" href="/app/log">
                Add labs
              </Link>
            </div>
            <div className="feature">
              <span className="ic">
                <Upload />
              </span>
              <h3>Import files</h3>
              <p>Bring in a FHIR records bundle or an Apple Health / CSV wearable export.</p>
              <Link className="btn btn-light" href="/app/connections">
                Import files
              </Link>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: 30, display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link className="btn btn-light" href="/app/profile">
              <ClipboardList size={16} /> Add your health profile
            </Link>
            <Link className="btn btn-dark" href="/app">
              Go to dashboard <ArrowRight />
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
