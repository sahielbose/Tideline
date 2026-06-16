import Link from "next/link";
import { Waves } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="word">
          tide<b>line</b>
        </div>
        <div style={{ marginTop: 14 }}>
          <span className="badge">
            <span className="mark">
              <Waves />
            </span>
            Open source, MIT
          </span>
        </div>
        <div className="links">
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <a href="https://github.com/sahielbose/Tideline">GitHub</a>
        </div>
        <p className="legal">
          Always review Tideline&apos;s insights with a licensed clinician. Tideline is an AI
          health companion, not a licensed medical provider, and it does not diagnose, treat, or
          deliver medical care.
          <br />
          <br />
          By using Tideline you accept our <Link href="/terms">Terms of Service</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>
      </div>
    </footer>
  );
}
