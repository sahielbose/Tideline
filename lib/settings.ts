/**
 * Runtime settings (CONTEXT.md §17). The app is fully functional with ZERO
 * external keys via the mock providers, but an operator can wire real providers
 * — Anthropic for the LLM, Resend for email — from the Settings UI without
 * editing env or restarting. Values entered there are stored in `app_settings`
 * (secrets encrypted at rest) and OVERRIDE the env defaults from `./config`.
 *
 * Everything that decides mock-vs-real reads through `getSettings()` here, so a
 * key added at runtime takes effect on the very next request.
 */
import { cache as reactCache } from "react";
import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { appSettings } from "./db/schema";
import { config } from "./config";
import type { AdapterKind } from "./types";

// Keys we manage at runtime. Stored verbatim in `app_settings.key`.
export type SettingKey =
  | "llm.apiKey"
  | "llm.modelAgent"
  | "llm.modelClassifier"
  | "email.apiKey"
  | "email.from";

/** Keys whose values are secrets and must be encrypted at rest. */
const SECRET_KEYS = new Set<SettingKey>(["llm.apiKey", "email.apiKey"]);

// ---------------------------------------------------------------------------
// encryption at rest (AES-256-GCM, key derived from AUTH_SECRET)
// ---------------------------------------------------------------------------
const ENC_PREFIX = "enc:v1:";

function encKey(): Buffer {
  // Derive a stable 32-byte key from the instance secret. If AUTH_SECRET is
  // unset we still derive a key so dev works; secrecy then rests on DB access.
  const secret = config.authSecret || "tideline-settings-key";
  return scryptSync(secret, "tideline-settings-salt", 32);
}

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    ENC_PREFIX +
    [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".")
  );
}

function decrypt(stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy/plaintext tolerance
  try {
    const [ivB64, tagB64, dataB64] = stored.slice(ENC_PREFIX.length).split(".");
    const decipher = createDecipheriv("aes-256-gcm", encKey(), Buffer.from(ivB64, "base64url"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // AUTH_SECRET changed or row corrupted — treat as unset rather than crash.
    return "";
  }
}

// ---------------------------------------------------------------------------
// resolved settings + cache
// ---------------------------------------------------------------------------
export interface RuntimeSettings {
  llm: {
    apiKey: string;
    provider: "anthropic" | "mock";
    modelAgent: string;
    modelClassifier: string;
    /** Where the active key comes from: a runtime override, env, or none. */
    source: "db" | "env" | "none";
  };
  email: {
    apiKey: string;
    enabled: boolean;
    from: string;
    source: "db" | "env" | "none";
  };
  dataAdapterDefault: AdapterKind;
}

/** Load runtime overrides from the DB, decrypting secrets. Empty on any error
 * (missing table, no DB) so the app degrades to env defaults / mock cleanly. */
async function loadOverrides(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const rows = await db.select().from(appSettings);
    for (const row of rows) {
      const value = SECRET_KEYS.has(row.key as SettingKey) ? decrypt(row.value) : row.value;
      if (value) map.set(row.key, value);
    }
  } catch {
    // table not migrated yet, or no DB in this context — fall back to env.
  }
  return map;
}

/**
 * The effective settings (DB overrides merged over env). Memoized per request
 * via React's `cache` — many gates call this within one render, but each new
 * request re-reads, so a save + revalidate is reflected immediately. There is
 * deliberately no cross-request module cache to keep stale (which would not
 * invalidate reliably across server-action vs render module contexts).
 */
export const getSettings = reactCache(async (): Promise<RuntimeSettings> => {
  const o = await loadOverrides();

  const llmKey = o.get("llm.apiKey") ?? config.llm.apiKey;
  const llmSource: "db" | "env" | "none" = o.has("llm.apiKey")
    ? "db"
    : config.llm.apiKey
      ? "env"
      : "none";

  const emailKey = o.get("email.apiKey") ?? config.email.apiKey;
  const emailSource: "db" | "env" | "none" = o.has("email.apiKey")
    ? "db"
    : config.email.apiKey
      ? "env"
      : "none";

  return {
    llm: {
      apiKey: llmKey,
      provider: llmKey ? "anthropic" : "mock",
      modelAgent: o.get("llm.modelAgent") || config.llm.modelAgent,
      modelClassifier: o.get("llm.modelClassifier") || config.llm.modelClassifier,
      source: llmSource,
    },
    email: {
      apiKey: emailKey,
      enabled: Boolean(emailKey),
      from: o.get("email.from") || config.email.from,
      source: emailSource,
    },
    dataAdapterDefault: config.dataAdapterDefault,
  };
});

export async function hasLLM(): Promise<boolean> {
  return (await getSettings()).llm.provider === "anthropic";
}

export async function hasEmail(): Promise<boolean> {
  return (await getSettings()).email.enabled;
}

// ---------------------------------------------------------------------------
// writes
// ---------------------------------------------------------------------------
/**
 * Upsert runtime settings. A value of `""` removes the override (reverting to
 * the env default / mock); `undefined` leaves a key untouched. Secrets are
 * encrypted before they hit the database.
 */
export async function updateRuntimeSettings(
  patch: Partial<Record<SettingKey, string | undefined>>,
): Promise<void> {
  for (const [k, raw] of Object.entries(patch)) {
    if (raw === undefined) continue;
    const key = k as SettingKey;
    const value = raw.trim();
    if (value === "") {
      await db.delete(appSettings).where(eq(appSettings.key, key));
      continue;
    }
    const stored = SECRET_KEYS.has(key) ? encrypt(value) : value;
    await db
      .insert(appSettings)
      .values({ key, value: stored, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: stored, updatedAt: new Date() },
      });
  }
}

// ---------------------------------------------------------------------------
// status view for the Settings UI (never returns raw secrets)
// ---------------------------------------------------------------------------
export interface IntegrationStatus {
  llm: {
    configured: boolean;
    masked: string | null;
    source: "db" | "env" | "none";
    /** Only DB overrides can be removed from the UI; env keys live in .env. */
    removable: boolean;
    modelAgent: string;
    modelClassifier: string;
  };
  email: {
    configured: boolean;
    masked: string | null;
    source: "db" | "env" | "none";
    removable: boolean;
    from: string;
  };
}

function mask(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "••••";
  return `${secret.slice(0, 6)}…${secret.slice(-4)}`;
}

export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const s = await getSettings();
  return {
    llm: {
      configured: s.llm.provider === "anthropic",
      masked: s.llm.apiKey ? mask(s.llm.apiKey) : null,
      source: s.llm.source,
      removable: s.llm.source === "db",
      modelAgent: s.llm.modelAgent,
      modelClassifier: s.llm.modelClassifier,
    },
    email: {
      configured: s.email.enabled,
      masked: s.email.apiKey ? mask(s.email.apiKey) : null,
      source: s.email.source,
      removable: s.email.source === "db",
      from: s.email.from,
    },
  };
}
