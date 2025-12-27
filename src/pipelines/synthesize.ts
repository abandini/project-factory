import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";
import { ProviderName } from "../providers/provider";

function extractJson(text: string): string {
  // Handle nested code blocks by finding the outermost ```json...``` wrapper
  // The response may contain markdown content with its own code blocks
  const trimmed = text.trim();

  // Check if starts with ```json or ``` and ends with ```
  if (trimmed.startsWith('```')) {
    // Find the first newline (end of opening fence)
    const firstNewline = trimmed.indexOf('\n');
    if (firstNewline === -1) return text;

    // Find the last ``` (closing fence)
    const lastFence = trimmed.lastIndexOf('```');
    if (lastFence <= firstNewline) return text;

    // Extract content between opening and closing fences
    return trimmed.slice(firstNewline + 1, lastFence).trim();
  }
  return text;
}

export async function synthesize(env: Env, prompt: string, prefer: "anthropic" | "workers_ai" = "workers_ai") {
  const provider = (prefer === "anthropic" && AnthropicProvider.isConfigured(env)) ? AnthropicProvider : WorkersAIProvider;
  const r = await provider.generate(env, prompt);

  let obj: unknown = null;
  try {
    const jsonText = extractJson(r.text);
    obj = JSON.parse(jsonText);
  } catch {
    obj = { error: "SYNTHESIS_JSON_PARSE_FAILED", raw: r.text, provider: r.provider };
  }
  return { provider: r.provider as ProviderName, rawText: r.text, json: obj };
}
