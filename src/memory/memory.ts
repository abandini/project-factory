import { v4 as uuidv4 } from "uuid";
import { Env } from "../core/state";
import { allowMemory } from "./policy";
import { insertMemory, markDeleted, getMemory } from "./store_d1";
import { embed, upsertVector, queryVectors, recordVectorPointer } from "./vectorize";

export type MemoryItem = {
  id: string;
  user_id: string;
  project_id?: string | null;
  kind: "preference" | "fact" | "decision" | "artifact" | "note";
  text: string;
  tags: string[];
  salience: number;
  source: "user" | "agent" | "system";
};

export async function remember(env: Env, item: Omit<MemoryItem, "id">): Promise<string> {
  const pol = allowMemory(item.text);
  if (!pol.allowed) throw new Error(`Memory blocked by policy: ${pol.reason}`);

  const id = uuidv4();
  await insertMemory(env, {
    id,
    user_id: item.user_id,
    project_id: item.project_id ?? null,
    kind: item.kind,
    text: item.text,
    tags: item.tags || [],
    salience: item.salience ?? 0.5,
    source: item.source,
  });

  const vec = await embed(env, item.text);
  const vector_id = `mem:${id}`;
  await upsertVector(env, {
    vector_id,
    values: vec,
    metadata: {
      user_id: item.user_id,
      project_id: item.project_id ?? null,
      kind: item.kind,
      salience: item.salience ?? 0.5,
    },
  });

  await recordVectorPointer(env, {
    memory_id: id,
    user_id: item.user_id,
    project_id: item.project_id ?? null,
    vector_id,
    embedding_model: "@cf/baai/bge-base-en-v1.5",
  });

  return id;
}

export async function recall(env: Env, args: { user_id: string; project_id?: string | null; query: string; k?: number }) {
  const vec = await embed(env, args.query);
  // Note: Vectorize metadata filtering requires indexed fields at index creation time.
  // For now, we query without filter and filter in application code.
  const matches = await queryVectors(env, {
    query_values: vec,
    topK: (args.k ?? 8) * 3, // Get more results to filter from
  });

  // Filter matches by user_id and optionally project_id from metadata
  const filtered = matches.filter((m: { id: string; metadata?: Record<string, unknown> }) => {
    const meta = m.metadata || {};
    if (meta.user_id !== args.user_id) return false;
    if (args.project_id && meta.project_id !== args.project_id) return false;
    return true;
  });

  // Take only top k after filtering
  const topMatches = filtered.slice(0, args.k ?? 8);

  const memoryIds = topMatches.map((m: { id: string }) => String(m.id).replace(/^mem:/, ""));
  const items = [];
  for (const mid of memoryIds) {
    const row = await getMemory(env, mid);
    if (row && !row.is_deleted) items.push(row);
  }
  return items;
}

export async function forget(env: Env, memory_id: string) {
  await markDeleted(env, memory_id);
}
