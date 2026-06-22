"use client";

/**
 * Integrations panel (CONTEXT.md §17). Lets the operator paste an Anthropic key
 * (and optionally a Resend key) so the AI and email paths go live at runtime —
 * no env edit, no restart. Stored secrets are never sent back to the client;
 * the server only returns a masked preview and the source.
 */
import { useState, useTransition } from "react";
import {
  Sparkles,
  Mail,
  KeyRound,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { showToast } from "@/components/toast";
import type { IntegrationStatus } from "@/lib/settings";
import {
  saveAiSettingsAction,
  removeAiKeyAction,
  testAiConnectionAction,
  saveEmailSettingsAction,
  removeEmailKeyAction,
  type TestResult,
} from "./actions";

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 12,
  padding: "11px 13px",
  fontSize: 15,
  fontFamily: "inherit",
  outline: "none",
  width: "100%",
};

function sourceLabel(source: "db" | "env" | "none"): string {
  if (source === "db") return "Saved here";
  if (source === "env") return "From environment (.env)";
  return "Not set";
}

function StatusPill({ on, onLabel, offLabel }: { on: boolean; onLabel: string; offLabel: string }) {
  return (
    <span className={`status ${on ? "ok" : "info"}`}>
      <span className="dot" />
      {on ? onLabel : offLabel}
    </span>
  );
}

export function IntegrationsSettings({ status }: { status: IntegrationStatus }) {
  return (
    <>
      <AiCard ai={status.llm} />
      <EmailCard email={status.email} />
    </>
  );
}

// ---------------------------------------------------------------------------
// AI provider (Anthropic)
// ---------------------------------------------------------------------------
function AiCard({ ai }: { ai: IntegrationStatus["llm"] }) {
  const [apiKey, setApiKey] = useState("");
  const [modelAgent, setModelAgent] = useState(ai.modelAgent);
  const [modelClassifier, setModelClassifier] = useState(ai.modelClassifier);
  const [test, setTest] = useState<TestResult | null>(null);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [removing, startRemove] = useTransition();

  const save = () =>
    startSave(async () => {
      await saveAiSettingsAction({ apiKey, modelAgent, modelClassifier });
      setApiKey("");
      setTest(null);
      showToast(apiKey ? "Anthropic key saved" : "AI settings saved");
    });

  const runTest = () =>
    startTest(async () => {
      setTest(null);
      const result = await testAiConnectionAction();
      setTest(result);
      showToast(result.ok ? "Connection works" : "Connection failed");
    });

  const remove = () =>
    startRemove(async () => {
      if (!confirm("Remove the Anthropic key? The app reverts to the built-in mock responses.")) return;
      await removeAiKeyAction();
      setTest(null);
      showToast("Anthropic key removed");
    });

  return (
    <div className="box" style={{ marginBottom: 20 }}>
      <div className="bhead">
        <span>
          <Sparkles style={{ verticalAlign: "-3px", marginRight: 8 }} size={16} />
          AI provider — Anthropic
        </span>
        <StatusPill on={ai.configured} onLabel="Live" offLabel="Mock mode" />
      </div>
      <div className="ins" style={{ borderBottom: "none" }}>
        <p style={{ marginBottom: 14 }}>
          Add an Anthropic API key to turn on the real AI doctor, lab explanations, insight
          summaries, and reviewer notes. Without a key, Tideline uses deterministic built-in
          responses. The key is encrypted at rest and applies to this whole instance.
        </p>

        <div
          className="muted"
          style={{ fontSize: 13, marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap" }}
        >
          <span>
            <KeyRound size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            {ai.configured ? `Current key ${ai.masked}` : "No key set"}
          </span>
          <span>Source: {sourceLabel(ai.source)}</span>
        </div>

        <div className="auth-form" style={{ gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 550 }}>
            Anthropic API key
            <input
              type="password"
              autoComplete="off"
              style={inputStyle}
              placeholder={ai.configured ? "Enter a new key to replace the current one" : "sk-ant-…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 550 }}>
              Agent model
              <input
                style={inputStyle}
                value={modelAgent}
                onChange={(e) => setModelAgent(e.target.value)}
                placeholder="claude-sonnet-4-6"
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 550 }}>
              Classifier model
              <input
                style={inputStyle}
                value={modelClassifier}
                onChange={(e) => setModelClassifier(e.target.value)}
                placeholder="claude-haiku-4-5-20251001"
              />
            </label>
          </div>
        </div>

        <div className="acts" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          <button className="btn btn-light" onClick={runTest} disabled={testing || !ai.configured}>
            {testing ? (
              <>
                <Loader2 className="spin" size={15} /> Testing…
              </>
            ) : (
              "Test connection"
            )}
          </button>
          {ai.removable && (
            <button className="btn btn-light" onClick={remove} disabled={removing}>
              <Trash2 size={15} /> {removing ? "Removing…" : "Remove key"}
            </button>
          )}
        </div>

        {test && (
          <div
            style={{
              marginTop: 14,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
              fontSize: 14,
              color: test.ok ? "var(--green-ink, #176b46)" : "var(--red-ink, #b4232a)",
            }}
          >
            {test.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
            <span>{test.message}</span>
          </div>
        )}

        <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
          Get a key from{" "}
          <a
            href="https://console.anthropic.com/settings/keys"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--blue-ink)" }}
          >
            console.anthropic.com <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
          </a>
          . Keys are billed by Anthropic per usage.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Email (Resend)
// ---------------------------------------------------------------------------
function EmailCard({ email }: { email: IntegrationStatus["email"] }) {
  const [apiKey, setApiKey] = useState("");
  const [from, setFrom] = useState(email.from);
  const [saving, startSave] = useTransition();
  const [removing, startRemove] = useTransition();

  const save = () =>
    startSave(async () => {
      await saveEmailSettingsAction({ apiKey, from });
      setApiKey("");
      showToast(apiKey ? "Resend key saved" : "Email settings saved");
    });

  const remove = () =>
    startRemove(async () => {
      if (!confirm("Remove the Resend key? Emails will be logged to the console instead of sent.")) return;
      await removeEmailKeyAction();
      showToast("Resend key removed");
    });

  return (
    <div className="box" style={{ marginBottom: 20 }}>
      <div className="bhead">
        <span>
          <Mail style={{ verticalAlign: "-3px", marginRight: 8 }} size={16} />
          Email — Resend
        </span>
        <StatusPill on={email.configured} onLabel="Sending" offLabel="Console log" />
      </div>
      <div className="ins" style={{ borderBottom: "none" }}>
        <p style={{ marginBottom: 14 }}>
          Optional. Add a Resend API key to actually deliver the notification emails users opt into.
          Without it, emails are written to the server console so nothing is lost.
        </p>

        <div
          className="muted"
          style={{ fontSize: 13, marginBottom: 16, display: "flex", gap: 14, flexWrap: "wrap" }}
        >
          <span>
            <KeyRound size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />
            {email.configured ? `Current key ${email.masked}` : "No key set"}
          </span>
          <span>Source: {sourceLabel(email.source)}</span>
        </div>

        <div className="auth-form" style={{ gap: 14 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 550 }}>
            Resend API key
            <input
              type="password"
              autoComplete="off"
              style={inputStyle}
              placeholder={email.configured ? "Enter a new key to replace the current one" : "re_…"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, fontWeight: 550 }}>
            From address
            <input
              style={inputStyle}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="Tideline <alerts@yourdomain.com>"
            />
          </label>
        </div>

        <div className="acts" style={{ gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
          {email.removable && (
            <button className="btn btn-light" onClick={remove} disabled={removing}>
              <Trash2 size={15} /> {removing ? "Removing…" : "Remove key"}
            </button>
          )}
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 16 }}>
          Get a key from{" "}
          <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer" style={{ color: "var(--blue-ink)" }}>
            resend.com <ExternalLink size={11} style={{ verticalAlign: "-1px" }} />
          </a>
          .
        </p>
      </div>
    </div>
  );
}
