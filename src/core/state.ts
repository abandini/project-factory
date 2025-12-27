export type AgentStatus = "created" | "brainstormed" | "synthesized" | "bootstrapped" | "blocked";

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  VEC: VectorizeIndex;
  ARTIFACTS: R2Bucket;
  AI: Ai;

  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROK_API_KEY?: string;
};

export const DEFAULT_USER_ID = "bill";
