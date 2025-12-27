import { Env } from "../core/state";

export type ProviderName = "workers_ai" | "anthropic" | "openai" | "gemini" | "grok";

export type LLMResult = { provider: ProviderName; text: string; raw?: unknown };

export interface Provider {
  name: ProviderName;
  isConfigured(env: Env): boolean;
  generate(env: Env, prompt: string): Promise<LLMResult>;
}
