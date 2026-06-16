import { ShieldAlert } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

export const metadata = { title: "Terms — Tideline" };

export default function TermsPage() {
  return (
    <>
      <div className="wrap prose-page">
        <h1 className="serif h1">Terms of Service</h1>
        <div className="disclaimer" style={{ margin: "16px 0 24px" }}>
          <ShieldAlert />
          <span>
            <strong>Tideline is not a licensed medical provider, doctor, or diagnostic service.</strong>{" "}
            It does not diagnose, treat, or prescribe, and it is not a substitute for professional
            medical care. For anything urgent or life-threatening, call your local emergency number.
          </span>
        </div>
        <h2 className="serif">Informational use only</h2>
        <p>
          Tideline provides general, informational guidance and monitoring. Always review its insights
          with a licensed clinician before acting on them. You are responsible for your own health
          decisions.
        </p>
        <h2 className="serif">No clinician relationship</h2>
        <p>
          Using Tideline does not create a doctor–patient relationship. The &ldquo;clinician
          review&rdquo; feature in this build is simulated by an AI persona and clearly labeled as
          such; no licensed human reviews your data unless your deployment connects a real one.
        </p>
        <h2 className="serif">Open source</h2>
        <p>
          Tideline is released under the MIT license. It is provided &ldquo;as is&rdquo;, without
          warranty of any kind. See the LICENSE file in the repository.
        </p>
        <h2 className="serif">Emergencies</h2>
        <p>
          Do not use Tideline for emergencies. If you think you are having a medical emergency, call
          your local emergency number or go to the nearest emergency room immediately.
        </p>
      </div>
      <SiteFooter />
    </>
  );
}
