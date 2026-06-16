import Link from "next/link";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = { title: "Sign in — Tideline" };

export default function LoginPage() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
          <Brand href="/" />
        </div>
        <h1 className="serif h2 center" style={{ marginBottom: 6 }}>
          Welcome back
        </h1>
        <p className="muted center" style={{ marginBottom: 22, fontSize: 14.5 }}>
          The demo account is prefilled — just continue.
        </p>
        <LoginForm />
        <p className="auth-legal">
          Tideline is informational and is not a licensed medical provider.{" "}
          <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
