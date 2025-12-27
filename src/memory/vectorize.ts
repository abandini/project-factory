import { Env } from "../core/state";
import { d1Exec } from "../core/tools";
import { nowIso } from "../core/util";

export async function embed(env: Env, text: string): Promise<number[]> {
  const res = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [text] });
  const vec = res?.data?.[0];
  if (!vec) throw new Error("Embedding failed (no vector returned).");
  return vec as number[];
}

export async function upsertVector(env: Env, args: {
  vector_id: string;
  values: number[];
  metadata: Record<string, unknown>;
}) {
  await env.VEC.upsert([{ id: args.vector_id, values: args.values, metadata: args.metadata }]);
}

export async function queryVectors(env: Env, args: {
  query_values: number[];
  topK: number;
  filter?: Record<string, unknown>;
}) {
  // Cloudflare Vectorize requires $eq operator syntax for filters
  // Convert { user_id: "bill" } to { user_id: { $eq: "bill" } }
  let cfFilter: Record<string, unknown> | undefined;
  if (args.filter) {
    cfFilter = {};
    for (const [key, value] of Object.entries(args.filter)) {
      if (value !== null && value !== undefined) {
        cfFilter[key] = { $eq: value };
      }
    }
    // If all values were null/undefined, don't use filter
    if (Object.keys(cfFilter).length === 0) {
      cfFilter = undefined;
    }
  }

  // Query Vectorize with returnMetadata to get full results
  const queryOptions: {
    topK: number;
    filter?: Record<string, unknown>;
    returnMetadata?: "all" | "indexed" | "none";
    returnValues?: boolean;
  } = {
    topK: args.topK,
    returnMetadata: "all",
    returnValues: false,
  };
  if (cfFilter) queryOptions.filter = cfFilter;

  const res = await env.VEC.query(args.query_values, queryOptions);
  return res?.matches || [];
}

export async function recordVectorPointer(env: Env, row: {
  memory_id: string;
  user_id: string;
  project_id?: string | null;
  vector_id: string;
  embedding_model: string;
}) {
  await d1Exec(
    env,
    `INSERT OR REPLACE INTO memory_vectors (memory_id, user_id, project_id, vector_id, embedding_model, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.memory_id, row.user_id, row.project_id ?? null, row.vector_id, row.embedding_model, nowIso()]
  );
}
