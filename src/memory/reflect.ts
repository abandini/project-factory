import { Env } from "../core/state";
import { listRecentMemories } from "./store_d1";
import { remember, MemoryItem } from "./memory";

export async function reflect(env: Env, args: { user_id: string; project_id?: string | null }) {
  const rows = await listRecentMemories(env, args.user_id, args.project_id ?? null, 40);
  if (rows.length < 8) return { ok: true, message: "Not enough memories to reflect." };

  const corpus = rows.map(r => `- (${r.kind}) ${r.text}`).join("\n");

  const prompt = `Summarize these memories into durable, high-signal items.
Return JSON array like:
[
 {"kind":"decision|preference|fact|note","text":"...","tags":["..."],"salience":0.0-1.0}
]
Memories:\n${corpus}`;

  const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { prompt });
  const text = out?.response ?? JSON.stringify(out);

  let arr: Array<{ kind?: string; text?: string; tags?: string[]; salience?: number }> = [];
  try { arr = JSON.parse(text); } catch { arr = []; }

  const created: string[] = [];
  for (const m of arr.slice(0, 3)) {
    if (!m?.text) continue;
    const id = await remember(env, {
      user_id: args.user_id,
      project_id: args.project_id ?? null,
      kind: (m.kind || "note") as MemoryItem["kind"],
      text: String(m.text),
      tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
      salience: typeof m.salience === "number" ? m.salience : 0.7,
      source: "agent",
    });
    created.push(id);
  }

  return { ok: true, created };
}
