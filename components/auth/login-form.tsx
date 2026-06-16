"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction, demoLoginAction, type AuthState } from "@/app/actions";
import { SubmitButton } from "../submit-button";

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});
  return (
    <>
      <form action={action} className="auth-form">
        <label>
          Email
          <input name="email" type="email" defaultValue="demo@tideline.app" required />
        </label>
        <label>
          Password
          <input name="password" type="password" defaultValue="tideline" required />
        </label>
        {state.error && <p className="auth-error">{state.error}</p>}
        <SubmitButton className="btn btn-primary" pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
      <div className="auth-divider">or</div>
      <form action={demoLoginAction}>
        <SubmitButton className="btn btn-light" pendingLabel="Loading…">
          Continue to the demo account
        </SubmitButton>
      </form>
      <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
        No account? <Link href="/signup" style={{ color: "var(--blue-ink)" }}>Create one</Link>
      </p>
    </>
  );
}
