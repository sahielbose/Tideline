import Link from "next/link";
import { Brand } from "@/components/brand";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata = { title: "Create account — Tideline" };

export default function SignupPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Brand href="/" />
        </div>
        <h1 className="serif h2 center" style={{ marginBottom: 6 }}>
          Create your account
        </h1>
        <p className="muted center" style={{ marginBottom: 22, fontSize: 14.5 }}>
          Then add your readings, labs, and records to start monitoring.
        </p>
        <SignupForm />
        <p className="auth-legal">
          Tideline is informational and is not a licensed medical provider.{" "}
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
