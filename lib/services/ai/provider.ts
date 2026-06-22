/**
 * The LLM provider seam. All model calls go through this so the provider/model
 * is swappable (CONTEXT.md §9). With no API key the app uses rule-based mock
 * implementations in the sibling modules and never instantiates a real client.
 *
 * The key and model names are read from runtime settings on every call, so a
 * key added from the Settings UI takes effect immediately (no restart). Callers
 * gate real calls behind `await hasLLM()`; if the LLM path is somehow reached
 * without a key, the provider throws a clear, actionable error.
 */
import { getSettings } from "../../settings";

export interface LLMMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CompleteOptions {
  system?: string;
  messages: LLMMessage[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type ToolExecutor = (name: string, input: Record<string, unknown>) => Promise<unknown>;

export interface ToolCompleteOptions extends CompleteOptions {
  tools: ToolDef[];
  executor: ToolExecutor;
  maxIters?: number;
}

export interface LLMProvider {
  readonly name: string;
  complete(opts: CompleteOptions): Promise<string>;
  stream(opts: CompleteOptions): AsyncIterable<string>;
  completeWithTools(opts: ToolCompleteOptions): Promise<string>;
}

const NO_KEY =
  "LLM provider not configured. Add an Anthropic API key in Settings → Integrations (or set LLM_API_KEY).";

class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  // Cache the SDK client per API key so a key rotation (e.g. via the Settings
  // UI) transparently rebuilds the client; the SDK is imported lazily so it is
  // never loaded on the keyless mock path.
  private cached: { key: string; client: import("@anthropic-ai/sdk").default } | null = null;

  private async client() {
    const { llm } = await getSettings();
    if (!llm.apiKey) throw new Error(NO_KEY);
    if (this.cached?.key === llm.apiKey) return this.cached.client;
    const mod = await import("@anthropic-ai/sdk");
    const client = new mod.default({ apiKey: llm.apiKey });
    this.cached = { key: llm.apiKey, client };
    return client;
  }

  private async agentModel(override?: string): Promise<string> {
    return override ?? (await getSettings()).llm.modelAgent;
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const client = await this.client();
    const resp = await client.messages.create({
      model: await this.agentModel(opts.model),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      system: opts.system,
      messages: opts.messages,
    });
    return resp.content
      .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  async *stream(opts: CompleteOptions): AsyncIterable<string> {
    const client = await this.client();
    const stream = client.messages.stream({
      model: await this.agentModel(opts.model),
      max_tokens: opts.maxTokens ?? 1024,
      temperature: opts.temperature ?? 0.4,
      system: opts.system,
      messages: opts.messages,
    });
    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  async completeWithTools(opts: ToolCompleteOptions): Promise<string> {
    const client = await this.client();
    const model = await this.agentModel(opts.model);
    const maxIters = opts.maxIters ?? 4;
    const messages: any[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
    let lastText = "";
    for (let i = 0; i < maxIters; i++) {
      const resp = await client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        temperature: opts.temperature ?? 0.4,
        system: opts.system,
        tools: opts.tools as any,
        messages,
      });
      lastText = resp.content
        .filter((b): b is { type: "text"; text: string } & typeof b => b.type === "text")
        .map((b) => b.text)
        .join("");
      const toolUses = resp.content.filter((b: any) => b.type === "tool_use");
      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) return lastText;

      messages.push({ role: "assistant", content: resp.content });
      const results: any[] = [];
      for (const tu of toolUses as { id: string; name: string; input: Record<string, unknown> }[]) {
        let out: unknown;
        try {
          out = await opts.executor(tu.name, tu.input ?? {});
        } catch (e) {
          out = { error: String(e) };
        }
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(out).slice(0, 4000),
        });
      }
      messages.push({ role: "user", content: results });
    }
    return lastText;
  }
}

// A single stateless wrapper is reused; it resolves the live key/model per call.
let provider: LLMProvider | null = null;
export function getProvider(): LLMProvider {
  if (!provider) provider = new AnthropicProvider();
  return provider;
}
