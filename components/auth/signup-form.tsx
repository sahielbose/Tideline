"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signupAction, type AuthState } from "@/app/actions";
import { SubmitButton } from "../submit-button";

export function SignupForm() {
  const [state, action] = useActionState<AuthState, FormData>(signupAction, {});
  return (
    <>
      <form action={action} className="auth-form">
        <label>
          Name
          <input name="name" type="text" placeholder="Your name" required />
        </label>
        <label>
          Email
          <input name="email" type="email" placeholder="you@example.com" required />
        </label>
        <label>
          Password
          <input name="password" type="password" placeholder="At least 6 characters" required />
        </label>
        {state.error && <p className="auth-error">{state.error}</p>}
        <SubmitButton className="btn btn-primary" pendingLabel="Creating…">
          Create account
        </SubmitButton>
      </form>
      <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
        Already have an account? <Link href="/login" style={{ color: "var(--blue-ink)" }}>Sign in</Link>
      </p>
    </>
  );
}
