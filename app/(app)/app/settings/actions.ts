"use server";

/**
 * Settings → Integrations server actions (CONTEXT.md §5, §17). Lets an operator
 * wire real providers (Anthropic LLM, Resend email) at runtime. Secrets are
 * written through lib/settings (encrypted at rest); every change is audit-logged
 * and never echoes a stored secret back to the client.
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { updateRuntimeSettings, getSettings } from "@/lib/settings";
import { getProvider } from "@/lib/services/ai/provider";
import { logAction } from "@/lib/services/audit";

async function uid(): Promise<string> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user.id;
}

export interface AiSettingsInput {
  /** New Anthropic key. Empty string is ignored (keeps the current key). */
  apiKey?: string;
  modelAgent?: string;
  modelClassifier?: string;
}

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<void> {
  const userId = await uid();
  const apiKey = (input.apiKey ?? "").trim();
  await updateRuntimeSettings({
    // Only overwrite the key when a new one was actually entered.
    ...(apiKey ? { "llm.apiKey": apiKey } : {}),
    "llm.modelAgent": (input.modelAgent ?? "").trim(),
    "llm.modelClassifier": (input.modelClassifier ?? "").trim(),
  });
  await logAction(userId, "settings.update", {
    area: "llm",
    keyChanged: Boolean(apiKey),
  });
  revalidatePath("/app/settings");
}

export async function removeAiKeyAction(): Promise<void> {
  const userId = await uid();
  await updateRuntimeSettings({ "llm.apiKey": "" });
  await logAction(userId, "settings.update", { area: "llm", removed: true });
  revalidatePath("/app/settings");
}

export interface TestResult {
  ok: boolean;
  message: string;
}

/** Make one tiny live call to confirm the configured key actually works. */
export async function testAiConnectionAction(): Promise<TestResult> {
  await uid();
  const { llm } = await getSettings();
  if (llm.provider !== "anthropic") {
    return { ok: false, message: "No Anthropic key configured — add one and save first." };
  }
  try {
    const reply = await getProvider().complete({
      system: "Reply with the single word: ok",
      messages: [{ role: "user", content: "ping" }],
      maxTokens: 8,
      temperature: 0,
    });
    return {
      ok: true,
      message: `Connected — ${llm.modelAgent} replied "${reply.trim().slice(0, 40) || "ok"}".`,
    };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    let message = raw;
    if (/401|authentication|invalid x-api-key|invalid api key/i.test(raw)) {
      message = "Authentication failed — the API key was rejected by Anthropic.";
    } else if (/404|not_found|model/i.test(raw)) {
      message = `Reached Anthropic, but the model "${llm.modelAgent}" was not found. Check the model name.`;
    } else if (/429|rate/i.test(raw)) {
      message = "Reached Anthropic, but the request was rate-limited. The key looks valid.";
    } else if (/credit|billing|quota/i.test(raw)) {
      message = "Reached Anthropic, but the account has no available credit/quota.";
    }
    return { ok: false, message };
  }
}

export interface EmailSettingsInput {
  apiKey?: string;
  from?: string;
}

export async function saveEmailSettingsAction(input: EmailSettingsInput): Promise<void> {
  const userId = await uid();
  const apiKey = (input.apiKey ?? "").trim();
  await updateRuntimeSettings({
    ...(apiKey ? { "email.apiKey": apiKey } : {}),
    "email.from": (input.from ?? "").trim(),
  });
  await logAction(userId, "settings.update", {
    area: "email",
    keyChanged: Boolean(apiKey),
  });
  revalidatePath("/app/settings");
}

export async function removeEmailKeyAction(): Promise<void> {
  const userId = await uid();
  await updateRuntimeSettings({ "email.apiKey": "" });
  await logAction(userId, "settings.update", { area: "email", removed: true });
  revalidatePath("/app/settings");
}
