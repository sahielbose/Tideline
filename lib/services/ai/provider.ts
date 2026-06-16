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

export interface LLMProvider {
  readonly name: string;
  complete(opts: CompleteOptions): Promise<string>;
  stream(opts: CompleteOptions): AsyncIterable<string>;
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
}

let cached: LLMProvider | null = null;
export function getProvider(): LLMProvider {
  if (cached) return cached;
  cached = hasLLM ? new AnthropicProvider() : new UnavailableProvider();
  return cached;
}
