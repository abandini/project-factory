import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenAIProvider } from "../providers/openai";
import { GeminiProvider } from "../providers/gemini";
import { GrokProvider } from "../providers/grok";
import { LLMResult } from "../providers/provider";

const providers = [WorkersAIProvider, AnthropicProvider, OpenAIProvider, GeminiProvider, GrokProvider];

export async function brainstorm(env: Env, args: { prompt: string; providerNames?: string[] }): Promise<LLMResult[]> {
  const wanted = new Set((args.providerNames && args.providerNames.length) ? args.providerNames : ["workers_ai"]);

  const results: LLMResult[] = [];
  for (const p of providers) {
    if (!wanted.has(p.name)) continue;
    if (!p.isConfigured(env) && p.name !== "workers_ai") continue;
    const r = await p.generate(env, args.prompt);
    results.push(r);
  }
  return results;
}
