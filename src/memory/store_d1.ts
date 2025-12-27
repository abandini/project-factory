import { Env } from "../core/state";
import { d1Exec, d1First, d1All } from "../core/tools";
import { nowIso } from "../core/util";

export type MemoryRow = {
  id: string;
  user_id: string;
  project_id: string | null;
  kind: string;
  text: string;
  tags_json: string;
  salience: number;
  source: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
};

export async function insertMemory(env: Env, row: {
  id: string;
  user_id: string;
  project_id?: string | null;
  kind: string;
  text: string;
  tags: string[];
  salience: number;
  source: "user" | "agent" | "system";
}) {
  const ts = nowIso();
  await d1Exec(
    env,
    `INSERT INTO memories
      (id, user_id, project_id, kind, text, tags_json, salience, source, created_at, updated_at, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      row.id,
      row.user_id,
      row.project_id ?? null,
      row.kind,
      row.text,
      JSON.stringify(row.tags || []),
      row.salience,
      row.source,
      ts,
      ts,
    ]
  );
}

export async function getMemory(env: Env, memoryId: string) {
  return await d1First<MemoryRow>(env, `SELECT * FROM memories WHERE id=?`, [memoryId]);
}

export async function markDeleted(env: Env, memoryId: string) {
  await d1Exec(
    env,
    `UPDATE memories SET is_deleted=1, deleted_at=?, updated_at=? WHERE id=?`,
    [nowIso(), nowIso(), memoryId]
  );
}

export async function listRecentMemories(env: Env, userId: string, projectId?: string | null, limit = 50) {
  if (projectId) {
    return await d1All<MemoryRow>(
      env,
      `SELECT * FROM memories WHERE user_id=? AND project_id=? AND is_deleted=0 ORDER BY created_at DESC LIMIT ?`,
      [userId, projectId, limit]
    );
  }
  return await d1All<MemoryRow>(
    env,
    `SELECT * FROM memories WHERE user_id=? AND is_deleted=0 ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
}
