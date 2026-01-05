import { Provider } from "./provider";
import { Env } from "../core/state";

export const OpenRouterProvider: Provider = {
  name: "openrouter",
  isConfigured: (env: Env) => Boolean(env.OPENROUTER_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.OPENROUTER_API_KEY) {
      return { provider: "openrouter" as const, text: "OPENROUTER_NOT_CONFIGURED" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      // OpenRouter API (OpenAI-compatible)
      const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "Authorization": `Bearer ${env.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "https://project-factory.bill-burkey.workers.dev",
          "X-Title": "Project Factory Brainstorm",
        },
        body: JSON.stringify({
          // Use Mistral Large for fast, high-quality responses
          model: "mistralai/mistral-large-2411",
          max_tokens: 2048,
          temperature: 0.4,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      clearTimeout(timeoutId);

      const raw = await resp.json().catch(() => ({})) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
        model?: string;
      };

      if (!resp.ok) {
        const msg = raw?.error?.message || JSON.stringify(raw);
        return { provider: "openrouter" as const, text: `OPENROUTER_ERROR: ${msg}`, raw };
      }

      const text = raw?.choices?.[0]?.message?.content || "";
      return { provider: "openrouter" as const, text: text || JSON.stringify(raw), raw };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return { provider: "openrouter" as const, text: "OPENROUTER_TIMEOUT: Request took too long" };
      }
      return { provider: "openrouter" as const, text: `OPENROUTER_ERROR: ${err}` };
    }
  },
};
