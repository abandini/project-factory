import { Provider } from "./provider";
import { Env } from "../core/state";

export const GrokProvider: Provider = {
  name: "grok",
  isConfigured: (env: Env) => Boolean(env.GROK_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.GROK_API_KEY) {
      return { provider: "grok" as const, text: "GROK_NOT_CONFIGURED" };
    }

    // xAI Grok API (OpenAI-compatible)
    const resp = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Authorization": `Bearer ${env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-3",
        max_tokens: 4096,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await resp.json().catch(() => ({})) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };

    if (!resp.ok) {
      const msg = raw?.error?.message || JSON.stringify(raw);
      return { provider: "grok" as const, text: `GROK_ERROR: ${msg}`, raw };
    }

    const text = raw?.choices?.[0]?.message?.content || "";
    return { provider: "grok" as const, text: text || JSON.stringify(raw), raw };
  },
};
