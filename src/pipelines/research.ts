import { Env } from "../core/state";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenRouterProvider } from "../providers/openrouter";
import { WorkersAIProvider } from "../providers/workers_ai";
import { ProviderName } from "../providers/provider";

function extractJson(text: string): string {
  // Look for ```json at the start, then find the LAST ``` that closes it
  const jsonStart = text.indexOf('```json');
  if (jsonStart !== -1) {
    const contentStart = text.indexOf('\n', jsonStart) + 1;
    const lastFence = text.lastIndexOf('\n```');
    if (lastFence > contentStart) {
      return text.substring(contentStart, lastFence).trim();
    }
    const lastFence2 = text.lastIndexOf('```');
    if (lastFence2 > contentStart) {
      return text.substring(contentStart, lastFence2).trim();
    }
  }

  // Fallback: find raw JSON object
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }

  return text;
}

export async function research(env: Env, prompt: string, prefer: "anthropic" | "openrouter" | "workers_ai" = "openrouter") {
  // Research requires careful analysis - use a high-quality provider
  let provider;
  if (prefer === "openrouter" && OpenRouterProvider.isConfigured(env)) {
    provider = OpenRouterProvider;
  } else if (prefer === "anthropic" && AnthropicProvider.isConfigured(env)) {
    provider = AnthropicProvider;
  } else {
    provider = WorkersAIProvider;
  }

  const r = await provider.generate(env, prompt);

  let obj: unknown = null;
  try {
    const jsonText = extractJson(r.text);
    obj = JSON.parse(jsonText);
  } catch {
    obj = { error: "RESEARCH_JSON_PARSE_FAILED", raw: r.text, provider: r.provider };
  }

  return { provider: r.provider as ProviderName, rawText: r.text, json: obj };
}
