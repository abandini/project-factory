import { Env } from "./state";
import { d1Exec } from "./tools";
import { nowIso } from "./util";

export async function recordArtifact(env: Env, a: {
  id: string;
  project_id: string;
  name: string;
  r2_key: string;
  content_type: string;
  bytes: number;
  sha256?: string;
}) {
  await d1Exec(
    env,
    `INSERT INTO artifacts (id, project_id, name, r2_key, content_type, bytes, sha256, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [a.id, a.project_id, a.name, a.r2_key, a.content_type, a.bytes, a.sha256 || null, nowIso()]
  );
}
