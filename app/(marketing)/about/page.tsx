import { ShieldAlert } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "About — Tideline" };

export default function AboutPage() {
  return (
    <>
      <div className="wrap prose-page">
        <h1 className="serif h1">About Tideline</h1>
        <div className="disclaimer" style={{ margin: "16px 0 24px" }}>
          <ShieldAlert />
          <span>
            Tideline is informational and is <strong>not a licensed medical provider</strong>, doctor,
            or diagnostic service. It does not diagnose, treat, or prescribe. For anything urgent or
            life-threatening, call your local emergency number.
          </span>
        </div>
        <p>
          Tideline turns your scattered health data — medical records, wearables, and lab results —
          into a single continuous timeline, watches that timeline for concerning trends, and explains
          in plain English whether something matters and what to do next. It is an open-source,
          self-hostable project under the MIT license.
        </p>
        <h2 className="serif">Why continuous monitoring</h2>
        <p>
          Most care is episodic: a once-a-year checkup misses the slow drift that happens in between.
          Tideline establishes your personal baselines and flags sustained changes — a steadily rising
          resting heart rate, falling HRV, blood pressure crossing a reference line — early, while
          they are still easy to act on.
        </p>
        <h2 className="serif">How it works</h2>
        <ul>
          <li><strong>Connect</strong> records, a wearable, and labs through pluggable adapters (with demo data built in).</li>
          <li><strong>Monitor</strong> with a clinical-drift engine that scores trends, reference crossings, anomalies, and cross-signal patterns.</li>
          <li><strong>Understand</strong> with plain-English insights, an AI doctor chat, and a lab explainer.</li>
          <li><strong>Act</strong> by flagging anything for a (simulated) clinician review.</li>
        </ul>
        <h2 className="serif">FAQ</h2>
        <p><strong>Is this medical advice?</strong> No. Tideline is informational only and never replaces a licensed clinician.</p>
        <p><strong>Are the clinicians real?</strong> No — the reviewer in this build is an AI persona, clearly labeled as simulated.</p>
        <p><strong>Who can see my data?</strong> It stays in your own database. You can export or delete everything at any time.</p>
      </div>
      <SiteFooter />
    </>
  );
}
