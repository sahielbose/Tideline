import type { AdapterKind } from "./types";

/**
 * Central, typed configuration. Everything else reads adapters and models from
 * here so selection is config-driven, never hard-coded (CONTEXT.md §17).
 *
 * The app is fully functional with ZERO external keys: when LLM_API_KEY is
 * absent the mock provider is used, when RESEND_API_KEY is absent notifications
 * are logged, and the default data adapter is `mock`.
 */
function env(key: string, fallback = ""): string {
  return process.env[key]?.trim() || fallback;
}

const databaseUrl = env(
  "DATABASE_URL",
  "postgresql://localhost:5432/tideline",
);

const llmApiKey = env("LLM_API_KEY");
const resendApiKey = env("RESEND_API_KEY");

export const config = {
  databaseUrl,
  authSecret: env("AUTH_SECRET", "tideline-dev-secret-change-me"),
  appUrl: env("APP_URL", "http://localhost:3000"),

  dataAdapterDefault: (env("DATA_ADAPTER_DEFAULT", "mock") as AdapterKind),

  llm: {
    apiKey: llmApiKey,
    provider: (llmApiKey ? "anthropic" : "mock") as "anthropic" | "mock",
    modelAgent: env("LLM_MODEL_AGENT", "claude-sonnet-4-6"),
    modelClassifier: env("LLM_MODEL_CLASSIFIER", "claude-haiku-4-5-20251001"),
  },

  email: {
    apiKey: resendApiKey,
    enabled: Boolean(resendApiKey),
    from: env("RESEND_FROM", "Tideline <alerts@tideline.local>"),
  },

  inngest: {
    eventKey: env("INNGEST_EVENT_KEY"),
    signingKey: env("INNGEST_SIGNING_KEY"),
  },

  sandbox: {
    recordsKey: env("RECORDS_SANDBOX_KEY"),
    wearablesKey: env("WEARABLES_SANDBOX_KEY"),
  },
} as const;

export const hasLLM = config.llm.provider === "anthropic";
export const hasEmail = config.email.enabled;
