import { Provider } from "./provider";
import { Env } from "../core/state";

export const WorkersAIProvider: Provider = {
  name: "workers_ai",
  isConfigured: (_env: Env) => true,
  async generate(env: Env, prompt: string) {
    const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { prompt });
    const text = out?.response ?? JSON.stringify(out);
    return { provider: "workers_ai" as const, text, raw: out };
  },
};
