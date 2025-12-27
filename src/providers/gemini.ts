import { Provider } from "./provider";
import { Env } from "../core/state";

export const GeminiProvider: Provider = {
  name: "gemini",
  isConfigured: (env: Env) => Boolean(env.GEMINI_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.GEMINI_API_KEY) {
      return { provider: "gemini" as const, text: "GEMINI_NOT_CONFIGURED" };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.GEMINI_API_KEY}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 4096,
        },
      }),
    });

    const raw = await resp.json().catch(() => ({})) as {
      error?: { message?: string };
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };

    if (!resp.ok) {
      const msg = raw?.error?.message || JSON.stringify(raw);
      return { provider: "gemini" as const, text: `GEMINI_ERROR: ${msg}`, raw };
    }

    const text = raw?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return { provider: "gemini" as const, text: text || JSON.stringify(raw), raw };
  },
};
