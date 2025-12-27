import { Provider } from "./provider";
import { Env } from "../core/state";

// Anthropic Messages API (basic implementation)
export const AnthropicProvider: Provider = {
  name: "anthropic",
  isConfigured: (env: Env) => Boolean(env.ANTHROPIC_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.ANTHROPIC_API_KEY) {
      return { provider: "anthropic" as const, text: "ANTHROPIC_NOT_CONFIGURED" };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await resp.json().catch(() => ({})) as {
      error?: { message?: string };
      content?: Array<{ type: string; text?: string }>
    };

    if (!resp.ok) {
      const msg = raw?.error?.message || JSON.stringify(raw);
      return { provider: "anthropic" as const, text: `ANTHROPIC_ERROR: ${msg}`, raw };
    }

    // content: [{type:"text", text:"..."}, ...]
    const text = Array.isArray(raw?.content)
      ? raw.content.map((c) => (c?.type === "text" ? c.text : "")).join("\n").trim()
      : "";

    return { provider: "anthropic" as const, text: text || JSON.stringify(raw), raw };
  },
};
