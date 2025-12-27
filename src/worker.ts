import { v4 as uuidv4 } from "uuid";
import { Env, DEFAULT_USER_ID } from "./core/state";
import { json, readJson, nowIso, renderTemplate } from "./core/util";
import { d1Exec, d1First, r2PutText, r2ListPrefix, r2GetObject } from "./core/tools";
import { recordArtifact } from "./core/artifacts";
import { makeOrchestrator } from "./core/orchestrator";
import { makeTarGz } from "./core/tar";

import { brainstorm } from "./pipelines/brainstorm";
import { synthesize } from "./pipelines/synthesize";
import { bootstrapRepo } from "./pipelines/bootstrap_repo";

import { remember, recall, forget, MemoryItem } from "./memory/memory";
import { reflect } from "./memory/reflect";

async function getPrompt(env: Env, name: string): Promise<string> {
  const kv = await env.KV.get(`prompts:${name}`);
  if (kv) return kv;
  if (name === "BRAINSTORM") return "Return JSON brainstorm. IDEA_SEED={{IDEA_SEED}} CONSTRAINTS_JSON={{CONSTRAINTS_JSON}}";
  if (name === "SYNTHESIZE") return "Return JSON with thesis, architecture, go_no_go, tasks, memory_candidates.";
  if (name === "BOOTSTRAP") return "Return JSON with files: [{path,content}].";
  return "";
}

function userIdFrom(body: Record<string, unknown>) {
  return String(body.user_id || DEFAULT_USER_ID);
}

async function createProject(env: Env, user_id: string, name: string, idea_seed: string, constraints: unknown) {
  const id = uuidv4();
  const ts = nowIso();
  await d1Exec(
    env,
    `INSERT INTO projects (id, user_id, name, idea_seed, constraints_json, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'created', ?, ?)`,
    [id, user_id, name, idea_seed, JSON.stringify(constraints || {}), ts, ts]
  );
  return id;
}

async function updateProjectStatus(env: Env, project_id: string, status: string) {
  await d1Exec(env, `UPDATE projects SET status=?, updated_at=? WHERE id=?`, [status, nowIso(), project_id]);
}

async function logRun(env: Env, run: {
  id: string;
  project_id: string;
  kind: string;
  status: "ok" | "error";
  input_json: unknown;
  output_json?: unknown;
  error_text?: string;
  started_at: string;
  finished_at: string;
}) {
  await d1Exec(
    env,
    `INSERT INTO runs (id, project_id, kind, status, input_json, output_json, error_text, started_at, finished_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.project_id,
      run.kind,
      run.status,
      JSON.stringify(run.input_json || {}),
      run.output_json ? JSON.stringify(run.output_json) : null,
      run.error_text || null,
      run.started_at,
      run.finished_at,
    ]
  );
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const orch = makeOrchestrator(env);

    try {
      // Memory endpoints
      if (url.pathname === "/memory/remember" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const id = await remember(env, {
          user_id: userIdFrom(body),
          project_id: (body.project_id as string) ?? null,
          kind: body.kind as MemoryItem["kind"],
          text: body.text as string,
          tags: (body.tags as string[]) || [],
          salience: (body.salience as number) ?? 0.6,
          source: (body.source as MemoryItem["source"]) ?? "user",
        });
        return json({ ok: true, id });
      }

      if (url.pathname === "/memory/recall" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const items = await recall(env, {
          user_id: userIdFrom(body),
          project_id: (body.project_id as string) ?? null,
          query: body.query as string,
          k: (body.k as number) ?? 8,
        });
        return json({ ok: true, items });
      }

      if (url.pathname === "/memory/reflect" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const out = await reflect(env, { user_id: userIdFrom(body), project_id: (body.project_id as string) ?? null });
        return json({ ok: true, ...out });
      }

      if (url.pathname === "/memory/forget" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        await forget(env, body.memory_id as string);
        return json({ ok: true });
      }

      // /brainstorm
      if (url.pathname === "/brainstorm" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const user_id = userIdFrom(body);

        const idea_seed = String(body.idea_seed || "");
        if (!idea_seed) return json({ ok: false, error: "idea_seed required" }, { status: 400 });

        const constraints = body.constraints || {};
        const project_name = String(body.project_name || "new-project");
        const providerNames = (body.providers as string[]) || ["workers_ai", "anthropic", "openai", "gemini", "grok"];

        const project_id = (body.project_id as string) || (await createProject(env, user_id, project_name, idea_seed, constraints));
        const started_at = nowIso();
        const run_id = uuidv4();

        const tpl = await getPrompt(env, "BRAINSTORM");
        const prompt = renderTemplate(tpl, {
          IDEA_SEED: idea_seed,
          CONSTRAINTS_JSON: JSON.stringify(constraints),
        });

        const results = await brainstorm(env, { prompt, providerNames });

        await updateProjectStatus(env, project_id, "brainstormed");
        await logRun(env, {
          id: run_id,
          project_id,
          kind: "brainstorm",
          status: "ok",
          input_json: { idea_seed, constraints, providers: providerNames },
          output_json: { results },
          started_at,
          finished_at: nowIso(),
        });

        await remember(env, {
          user_id,
          project_id,
          kind: "decision",
          text: "Project intent: convert idea exploration into a rigorous repo pack on Cloudflare (Workers, AI, D1, Vectorize, R2, secure env vars), with GitHub as system of record.",
          tags: ["project-factory", "intent", "cloudflare", "github"],
          salience: 0.95,
          source: "system",
        });

        await remember(env, {
          user_id,
          project_id,
          kind: "fact",
          text: `Idea seed: ${idea_seed}`,
          tags: ["idea-seed"],
          salience: 0.85,
          source: "user",
        });

        return json({ ok: true, project_id, results, logs: orch.log.events });
      }

      // /synthesize
      if (url.pathname === "/synthesize" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const user_id = userIdFrom(body);
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        const project = await d1First<{ idea_seed: string; constraints_json: string }>(env, `SELECT * FROM projects WHERE id=?`, [project_id]);
        if (!project) return json({ ok: false, error: "project not found" }, { status: 404 });

        const started_at = nowIso();
        const run_id = uuidv4();

        const runRows = await env.DB.prepare(
          `SELECT * FROM runs WHERE project_id=? AND kind='brainstorm' ORDER BY started_at DESC LIMIT 1`
        )
          .bind(project_id)
          .all();

        const last = runRows.results?.[0] as { output_json?: string } | undefined;
        const brainstorm_packet = last?.output_json ? JSON.parse(last.output_json) : { results: [] };

        const tpl = await getPrompt(env, "SYNTHESIZE");
        const prompt = renderTemplate(tpl, {
          IDEA_SEED: project.idea_seed,
          CONSTRAINTS_JSON: project.constraints_json,
          BRAINSTORM_PACKET_JSON: JSON.stringify(brainstorm_packet),
        });

        // prefer Anthropic for synthesis if configured
        const out = await synthesize(env, prompt, "anthropic");

        await updateProjectStatus(env, project_id, "synthesized");

        const outJson = out.json as Record<string, unknown> | null;
        await logRun(env, {
          id: run_id,
          project_id,
          kind: "synthesize",
          status: outJson?.error ? "error" : "ok",
          input_json: { prompt_meta: "SYNTHESIZE", project_id, prefer: "anthropic" },
          output_json: out,
          error_text: outJson?.error ? String(outJson.error) : undefined,
          started_at,
          finished_at: nowIso(),
        });

        const candidates = (outJson as { memory_candidates?: Array<{ kind?: string; text?: string; tags?: string[]; salience?: number }> })?.memory_candidates;
        if (Array.isArray(candidates)) {
          for (const c of candidates.slice(0, 12)) {
            if (!c?.text) continue;
            await remember(env, {
              user_id,
              project_id,
              kind: (c.kind || "note") as MemoryItem["kind"],
              text: String(c.text),
              tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
              salience: typeof c.salience === "number" ? c.salience : 0.7,
              source: "agent",
            });
          }
        }

        return json({ ok: true, project_id, synthesized: out.json, raw: out.rawText, provider: out.provider });
      }

      // /bootstrap
      if (url.pathname === "/bootstrap" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const user_id = userIdFrom(body);
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        const runs = await env.DB.prepare(
          `SELECT * FROM runs WHERE project_id=? AND kind='synthesize' ORDER BY started_at DESC LIMIT 1`
        )
          .bind(project_id)
          .all();

        const last = runs.results?.[0] as { output_json?: string } | undefined;
        if (!last?.output_json) return json({ ok: false, error: "No synthesis found" }, { status: 400 });

        const synthObj = JSON.parse(last.output_json) as { json?: unknown };
        const synthesized = synthObj?.json ?? synthObj;

        const started_at = nowIso();
        const run_id = uuidv4();

        const tpl = await getPrompt(env, "BOOTSTRAP");
        const prompt = renderTemplate(tpl, {
          SYNTHESIZED_JSON: JSON.stringify(synthesized),
        });

        // prefer Anthropic for bootstrap if configured
        const out = await bootstrapRepo(env, prompt, "anthropic");

        const outJson = out.json as { error?: string; files?: Array<{ path?: string; content?: string }> } | null;
        const files = outJson?.files;
        const stored: Array<{ path: string; r2_key: string; bytes: number }> = [];

        if (Array.isArray(files)) {
          for (const f of files) {
            const path = String(f.path || "");
            const content = String(f.content || "");
            if (!path) continue;

            const r2_key = `projects/${project_id}/repo-pack/${path}`;
            const bytes = await r2PutText(env, r2_key, content, "text/markdown; charset=utf-8");
            const artifact_id = uuidv4();

            await recordArtifact(env, {
              id: artifact_id,
              project_id,
              name: path,
              r2_key,
              content_type: "text/markdown",
              bytes,
            });

            stored.push({ path, r2_key, bytes });
          }
        }

        await updateProjectStatus(env, project_id, "bootstrapped");
        await logRun(env, {
          id: run_id,
          project_id,
          kind: "bootstrap",
          status: outJson?.error ? "error" : "ok",
          input_json: { prompt_meta: "BOOTSTRAP", prefer: "anthropic" },
          output_json: { stored, raw: out.rawText, provider: out.provider },
          error_text: outJson?.error ? String(outJson.error) : undefined,
          started_at,
          finished_at: nowIso(),
        });

        await remember(env, {
          user_id,
          project_id,
          kind: "artifact",
          text: `Repo pack generated in R2: projects/${project_id}/repo-pack/ (THESIS.md, ARCHITECTURE.md, GO_NO_GO.md, TASKS.md).`,
          tags: ["artifact", "repo-pack", "r2"],
          salience: 0.85,
          source: "system",
        });

        return json({ ok: true, project_id, stored, provider: out.provider });
      }

      // /download — returns .tar.gz of repo-pack
      if (url.pathname === "/download" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        const prefix = `projects/${project_id}/repo-pack/`;
        const objs = await r2ListPrefix(env, prefix);

        const files: Array<{ path: string; data: Uint8Array }> = [];
        for (const o of objs) {
          const key = o.key;
          const relPath = key.replace(prefix, "");
          const obj = await r2GetObject(env, key);
          if (!obj) continue;
          const ab = await obj.arrayBuffer();
          files.push({ path: relPath, data: new Uint8Array(ab) });
        }

        const gzStream = await makeTarGz(files);
        return new Response(gzStream, {
          status: 200,
          headers: {
            "content-type": "application/gzip",
            "content-disposition": `attachment; filename=repo-pack-${project_id}.tar.gz`,
          },
        });
      }

      if (url.pathname === "/" && req.method === "GET") {
        return new Response("project-factory OK", { status: 200 });
      }

      return json({ ok: false, error: "Not found" }, { status: 404 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return json({ ok: false, error: msg }, { status: 500 });
    }
  },
};
