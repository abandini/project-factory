import { Provider } from "./provider";
import { Env } from "../core/state";

export const OpenAIProvider: Provider = {
  name: "openai",
  isConfigured: (env: Env) => Boolean(env.OPENAI_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.OPENAI_API_KEY) {
      return { provider: "openai" as const, text: "OPENAI_NOT_CONFIGURED" };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          max_tokens: 2048,
          temperature: 0.4,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      clearTimeout(timeoutId);

      const raw = await resp.json().catch(() => ({})) as {
        error?: { message?: string };
        choices?: Array<{ message?: { content?: string } }>;
      };

      if (!resp.ok) {
        const msg = raw?.error?.message || JSON.stringify(raw);
        return { provider: "openai" as const, text: `OPENAI_ERROR: ${msg}`, raw };
      }

      const text = raw?.choices?.[0]?.message?.content || "";
      return { provider: "openai" as const, text: text || JSON.stringify(raw), raw };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        return { provider: "openai" as const, text: "OPENAI_TIMEOUT: Request took too long" };
      }
      return { provider: "openai" as const, text: `OPENAI_ERROR: ${err}` };
    }
  },
};
