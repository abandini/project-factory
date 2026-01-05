import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenAIProvider } from "../providers/openai";
import { GeminiProvider } from "../providers/gemini";
import { GrokProvider } from "../providers/grok";
import { OpenRouterProvider } from "../providers/openrouter";
import { LLMResult } from "../providers/provider";

const providers = [WorkersAIProvider, AnthropicProvider, OpenAIProvider, GeminiProvider, GrokProvider, OpenRouterProvider];

export async function brainstorm(env: Env, args: { prompt: string; providerNames?: string[] }): Promise<LLMResult[]> {
  const wanted = new Set((args.providerNames && args.providerNames.length) ? args.providerNames : ["workers_ai"]);

  // Filter to only wanted and configured providers
  const activeProviders = providers.filter(p => {
    if (!wanted.has(p.name)) return false;
    if (!p.isConfigured(env) && p.name !== "workers_ai") return false;
    return true;
  });

  // Call all providers in parallel for speed
  const results = await Promise.all(
    activeProviders.map(p => p.generate(env, args.prompt))
  );

  return results;
}
