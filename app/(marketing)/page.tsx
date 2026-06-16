import Link from "next/link";
import {
  Shield,
  Clock,
  CheckCircle2,
  FolderHeart,
  Stethoscope,
  FlaskConical,
  Heart,
  Moon,
  Activity,
  Waves,
  Check,
  Lock,
} from "lucide-react";
import { HeroConsult } from "@/components/marketing/hero-consult";
import { SiteFooter } from "@/components/site-footer";

const RECORD_ORGS = ["Acme Health", "Kaiser Permanente", "Optum", "St Luke's", "UPMC", "Vanderbilt", "Allina"];
const WEARABLES = ["Fitbit", "Garmin", "Oura", "Dexcom", "Omron", "Strava"];

export default function LandingPage() {
  return (
    <>
      {/* HERO — route: / and /ai-doctor */}
      <div className="wrap hero">
        <h1 className="serif h-display">
          Welcome to <span className="name">Tideline</span>
        </h1>
        <svg className="wave-underline" viewBox="0 0 360 14" preserveAspectRatio="none" fill="none" aria-hidden>
          <path
            d="M2 8c30 0 30-6 60-6s30 6 60 6 30-6 60-6 30 6 60 6 30-6 56-6"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        <p className="serif sub">Your always-on health companion</p>
        <p className="desc lead">
          Get free guidance from an AI health companion, and request a clinician review the moment
          you want a human in the loop.
        </p>

        <HeroConsult />

        <div className="quick">
          <Link className="chip" href="/app">
            <FolderHeart /> View my records
          </Link>
          <Link className="chip" href="/app/reviews">
            <Stethoscope /> Request a review
          </Link>
          <Link className="chip" href="/app/labs">
            <FlaskConical /> Order a lab
          </Link>
        </div>

        <div className="trust">
          <span className="badge">
            <span className="mark">
              <Waves />
            </span>
            Open source
          </span>
          <span className="chip soft">
            <Shield /> Private by default
          </span>
        </div>
      </div>

      {/* WHY PEOPLE CHOOSE TIDELINE */}
      <div className="wrap section" style={{ paddingTop: 30 }}>
        <h2 className="serif h1 center reveal in">Why people choose Tideline</h2>
        <div className="cards-3">
          <div className="feature reveal in d1">
            <span className="ic">
              <Shield />
            </span>
            <h3>Private by default</h3>
            <p>
              Your conversations are encrypted and yours. We never sell your data, and you can export
              or delete it anytime.
            </p>
          </div>
          <div className="feature reveal in d2">
            <span className="ic">
              <Clock />
            </span>
            <h3>Always available</h3>
            <p>Ask about your health any time, day or night, and get a clear answer in plain language in seconds.</p>
          </div>
          <div className="feature reveal in d3">
            <span className="ic">
              <CheckCircle2 />
            </span>
            <h3>Built with clinicians</h3>
            <p>
              Guidance is shaped with medical input, and you can request a licensed clinician review
              whenever you want one.
            </p>
          </div>
        </div>
      </div>

      {/* LOGO STRIP — RecordsAdapter */}
      <div className="wrap logos reveal in">
        <p className="cap">Connect records from more than 50,000 healthcare organizations across the US</p>
        <div className="logo-row">
          {RECORD_ORGS.map((o, i) => (
            <span key={o} className={i % 3 === 0 ? "serif" : ""}>
              {o}
            </span>
          ))}
        </div>
      </div>

      {/* TALK NATURALLY */}
      <div className="wrap section">
        <div className="split">
          <div className="copy reveal in">
            <h2 className="serif h1">Talk naturally</h2>
            <p className="lead">No medical jargon needed. Just describe how you are feeling, in your own words.</p>
          </div>
          <div className="mock-chat reveal in d1">
            <div className="bubble bot">What brings you in today?</div>
            <div className="bubble user">I&apos;ve had a headache for three days</div>
            <div className="typing">
              <span className="dots">
                <i />
                <i />
                <i />
              </span>{" "}
              Start your visit anytime
            </div>
          </div>
        </div>
      </div>

      {/* REAL CLINICIANS — /app/reviews createReviewFlag */}
      <div className="wrap" style={{ paddingBottom: 20 }}>
        <div className="dark-card reveal in">
          <div className="left">
            <h2 className="serif h2">Real clinicians, when you need them</h2>
            <p>
              Request a review from a licensed clinician. Get written guidance, a clear set of next
              steps, and follow-up messaging.
            </p>
            <ul>
              <li>
                <span className="tick">
                  <Check />
                </span>
                Board-certified clinicians
              </li>
              <li>
                <span className="tick">
                  <Check />
                </span>
                Guidance sent straight to you
              </li>
              <li>
                <span className="tick">
                  <Check />
                </span>
                No insurance required
              </li>
            </ul>
          </div>
          <Link className="btn btn-light" href="/app/reviews" style={{ fontSize: 15, padding: "13px 22px" }}>
            Request a review
          </Link>
        </div>
      </div>

      {/* PERSONALIZED TO YOU — BiometricsAdapter */}
      <div className="wrap section">
        <div className="split">
          <div className="metric-mini reveal in">
            <div className="mini-row">
              <div className="mini hr">
                <span className="lab">
                  <Heart /> Heart rate
                </span>
                <div className="val">
                  72<small>bpm</small>
                </div>
              </div>
              <div className="mini sl">
                <span className="lab">
                  <Moon /> Sleep
                </span>
                <div className="val">
                  7:23<small>hrs</small>
                </div>
              </div>
              <div className="mini ac">
                <span className="lab">
                  <Activity /> Activity
                </span>
                <div className="val">
                  8,432<small>steps</small>
                </div>
              </div>
            </div>
            <p className="mini-cap">Connects to popular wearables</p>
            <div className="logo-row" style={{ justifyContent: "flex-start", gap: 22, opacity: 0.6 }}>
              {WEARABLES.map((w, i) => (
                <span key={w} className={i % 2 === 1 ? "serif" : ""}>
                  {w}
                </span>
              ))}
            </div>
          </div>
          <div className="copy reveal in d1">
            <h2 className="serif h1">Personalized to you</h2>
            <p className="lead">
              Connect your wearables and records for sharper, more relevant insight that knows your
              full story.
            </p>
          </div>
        </div>
      </div>

      {/* WE WATCH YOUR VITALS — runMonitoringSweep + insights */}
      <div className="wrap section" style={{ paddingTop: 0 }}>
        <div className="split">
          <div className="copy reveal in">
            <h2 className="serif h1">We watch your vitals, so you don&apos;t have to</h2>
            <p className="lead">
              Tideline keeps an eye on your health data in the background. When something looks
              unusual, like a steady rise in resting heart rate or a shift in your sleep, you hear
              about it before it becomes a problem.
            </p>
          </div>
          <div className="reveal in d1" style={{ display: "flex", justifyContent: "center" }}>
            <Link className="notif in" href="/app" style={{ cursor: "pointer" }}>
              <div className="top">
                <span className="who">
                  <span className="badge-dot">
                    <Waves />
                  </span>
                  Tideline
                </span>
                <span className="when">now</span>
              </div>
              <p>Your resting heart rate has been elevated for two nights. Tap to review.</p>
            </Link>
          </div>
        </div>
      </div>

      {/* READY TO GET STARTED */}
      <div className="wrap" style={{ paddingBottom: 30 }}>
        <div className="cta-band reveal in">
          <h2 className="serif h1">Ready to get started?</h2>
          <HeroConsult placeholder="Describe your symptoms…" cta="Begin consult" />
          <p className="chat-foot" style={{ marginTop: 16 }}>
            <Lock /> Encrypted
          </p>
        </div>
      </div>

      <SiteFooter />
    </>
  );
}
