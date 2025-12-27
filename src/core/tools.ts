import { Env } from "./state";

export async function d1Exec(env: Env, sql: string, params: unknown[] = []) {
  const stmt = env.DB.prepare(sql);
  const res = params.length ? await stmt.bind(...params).run() : await stmt.run();
  return res;
}

export async function d1All<T = unknown>(env: Env, sql: string, params: unknown[] = []): Promise<T[]> {
  const stmt = env.DB.prepare(sql);
  const res = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return (res.results || []) as T[];
}

export async function d1First<T = unknown>(env: Env, sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await d1All<T>(env, sql, params);
  return rows.length ? rows[0] : null;
}

export async function r2PutText(env: Env, key: string, text: string, contentType: string) {
  const bytes = new TextEncoder().encode(text);
  await env.ARTIFACTS.put(key, bytes, { httpMetadata: { contentType } });
  return bytes.byteLength;
}

export async function r2ListPrefix(env: Env, prefix: string) {
  const out = await env.ARTIFACTS.list({ prefix });
  return out.objects || [];
}

export async function r2GetObject(env: Env, key: string) {
  return await env.ARTIFACTS.get(key);
}
