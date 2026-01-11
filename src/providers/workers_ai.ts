import { Provider } from "./provider";
import { Env } from "../core/state";

export const WorkersAIProvider: Provider = {
  name: "workers_ai",
  isConfigured: (_env: Env) => true,
  async generate(env: Env, prompt: string) {
    // Use Llama 3.1 70B with 128K context for complex prompts
    // Falls back to 8B if 70B fails (rate limits, etc.)
    try {
      const out = await env.AI.run("@cf/meta/llama-3.1-70b-instruct", {
        prompt,
        max_tokens: 8192,
      });
      const text = out?.response ?? JSON.stringify(out);
      return { provider: "workers_ai" as const, text, raw: out };
    } catch (err) {
      // Fallback to smaller model for simple queries
      console.log("70B model failed, falling back to 8B:", err);
      const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        prompt: prompt.slice(0, 6000), // Truncate for 8K context
        max_tokens: 2048,
      });
      const text = out?.response ?? JSON.stringify(out);
      return { provider: "workers_ai" as const, text, raw: out };
    }
  },
};
