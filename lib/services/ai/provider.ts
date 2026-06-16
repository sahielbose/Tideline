/**
 * The LLM provider seam. All model calls go through this so the provider/model
 * is swappable (CONTEXT.md §9). With no API key the app uses rule-based mock
 * implementations in the sibling modules and never instantiates a real client.
 */
import { config, hasLLM } from "../../config";

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

class AnthropicProvider implements LLMProvider {
  readonly name = "anthropic";
  // Lazily imported so the SDK is never loaded in the keyless mock path.
  private clientPromise: Promise<import("@anthropic-ai/sdk").default> | null = null;

  private async client() {
    if (!this.clientPromise) {
      this.clientPromise = import("@anthropic-ai/sdk").then(
        (m) => new m.default({ apiKey: config.llm.apiKey }),
      );
    }
    return this.clientPromise;
  }

  async complete(opts: CompleteOptions): Promise<string> {
    const client = await this.client();
    const resp = await client.messages.create({
      model: opts.model ?? config.llm.modelAgent,
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
      model: opts.model ?? config.llm.modelAgent,
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
    const maxIters = opts.maxIters ?? 4;
    const messages: any[] = opts.messages.map((m) => ({ role: m.role, content: m.content }));
    let lastText = "";
    for (let i = 0; i < maxIters; i++) {
      const resp = await client.messages.create({
        model: opts.model ?? config.llm.modelAgent,
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

/** A guard provider used only if something calls the LLM in keyless mode. */
class UnavailableProvider implements LLMProvider {
  readonly name = "mock";
  async complete(): Promise<string> {
    throw new Error("LLM provider not configured (no LLM_API_KEY). Use the rule-based path.");
  }
  async *stream(): AsyncIterable<string> {
    throw new Error("LLM provider not configured (no LLM_API_KEY). Use the rule-based path.");
  }
  async completeWithTools(): Promise<string> {
    throw new Error("LLM provider not configured (no LLM_API_KEY). Use the rule-based path.");
  }
}

let cached: LLMProvider | null = null;
export function getProvider(): LLMProvider {
  if (cached) return cached;
  cached = hasLLM ? new AnthropicProvider() : new UnavailableProvider();
  return cached;
}
