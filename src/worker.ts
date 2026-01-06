import { v4 as uuidv4 } from "uuid";
import { Env, DEFAULT_USER_ID } from "./core/state";
import { json, readJson, nowIso, renderTemplate, handleCors } from "./core/util";
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

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
      return handleCors();
    }

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

      // ============ Ideas (lightweight capture) ============

      // POST /ideas - Quick capture an idea without processing
      if (url.pathname === "/ideas" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const user_id = userIdFrom(body);
        const idea_seed = String(body.idea_seed || "");
        if (!idea_seed) return json({ ok: false, error: "idea_seed required" }, { status: 400 });

        const id = uuidv4();
        const ts = nowIso();
        const title = body.title ? String(body.title) : null;
        const notes = body.notes ? String(body.notes) : null;

        await d1Exec(
          env,
          `INSERT INTO ideas (id, user_id, title, idea_seed, notes, status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
          [id, user_id, title, idea_seed, notes, ts, ts]
        );

        return json({ ok: true, id, status: "draft" });
      }

      // GET /ideas - List all ideas
      if (url.pathname === "/ideas" && req.method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const status = url.searchParams.get("status"); // optional filter

        let query = `SELECT id, user_id, title, idea_seed, notes, status, project_id, created_at, updated_at FROM ideas`;
        const params: (string | number)[] = [];

        if (status) {
          query += ` WHERE status = ?`;
          params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();
        const ideas = result.results || [];

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM ideas`;
        if (status) {
          countQuery += ` WHERE status = ?`;
        }
        const countResult = await env.DB.prepare(countQuery).bind(...(status ? [status] : [])).first<{ total: number }>();
        const total = countResult?.total || 0;

        return json({
          ok: true,
          ideas,
          pagination: { limit, offset, total }
        });
      }

      // GET /ideas/:id - Get single idea with context
      const getIdeaMatch = url.pathname.match(/^\/ideas\/([^/]+)$/);
      if (getIdeaMatch && req.method === "GET") {
        const idea_id = getIdeaMatch[1];

        const idea = await d1First<{
          id: string;
          user_id: string;
          title: string | null;
          idea_seed: string;
          notes: string | null;
          status: string;
          project_id: string | null;
          created_at: string;
          updated_at: string;
        }>(env, `SELECT * FROM ideas WHERE id=?`, [idea_id]);

        if (!idea) {
          return json({ ok: false, error: "idea not found" }, { status: 404 });
        }

        // Get attached context
        const contextResult = await env.DB.prepare(
          `SELECT id, kind, content, metadata_json, created_at FROM idea_context WHERE idea_id=? ORDER BY created_at ASC`
        ).bind(idea_id).all();
        const context = contextResult.results || [];

        return json({ ok: true, idea, context });
      }

      // POST /ideas/:id/context - Add context to an idea (links, notes, files)
      const addContextMatch = url.pathname.match(/^\/ideas\/([^/]+)\/context$/);
      if (addContextMatch && req.method === "POST") {
        const idea_id = addContextMatch[1];
        const body = await readJson(req) as Record<string, unknown>;

        const idea = await d1First(env, `SELECT id FROM ideas WHERE id=?`, [idea_id]);
        if (!idea) {
          return json({ ok: false, error: "idea not found" }, { status: 404 });
        }

        const kind = String(body.kind || "note"); // link, note, file, screenshot
        const content = String(body.content || "");
        if (!content) return json({ ok: false, error: "content required" }, { status: 400 });

        const metadata = body.metadata || null;
        const id = uuidv4();
        const ts = nowIso();

        await d1Exec(
          env,
          `INSERT INTO idea_context (id, idea_id, kind, content, metadata_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, idea_id, kind, content, metadata ? JSON.stringify(metadata) : null, ts]
        );

        // Update idea's updated_at
        await d1Exec(env, `UPDATE ideas SET updated_at=? WHERE id=?`, [ts, idea_id]);

        return json({ ok: true, id, kind });
      }

      // POST /ideas/:id/process - Convert idea to full project and run pipeline
      const processIdeaMatch = url.pathname.match(/^\/ideas\/([^/]+)\/process$/);
      if (processIdeaMatch && req.method === "POST") {
        const idea_id = processIdeaMatch[1];
        const body = await readJson(req) as Record<string, unknown>;

        const idea = await d1First<{
          id: string;
          user_id: string;
          title: string | null;
          idea_seed: string;
          notes: string | null;
          status: string;
        }>(env, `SELECT * FROM ideas WHERE id=?`, [idea_id]);

        if (!idea) {
          return json({ ok: false, error: "idea not found" }, { status: 404 });
        }

        if (idea.status === "converted") {
          return json({ ok: false, error: "idea already converted" }, { status: 400 });
        }

        // Get all context for the idea
        const contextResult = await env.DB.prepare(
          `SELECT kind, content, metadata_json FROM idea_context WHERE idea_id=? ORDER BY created_at ASC`
        ).bind(idea_id).all();
        const contextItems = contextResult.results || [];

        // Build enhanced idea_seed with context
        let enrichedSeed = idea.idea_seed;
        if (idea.notes) {
          enrichedSeed += `\n\nNotes: ${idea.notes}`;
        }

        const links: string[] = [];
        const additionalNotes: string[] = [];
        for (const c of contextItems as Array<{ kind: string; content: string; metadata_json?: string }>) {
          if (c.kind === "link") {
            links.push(c.content);
          } else if (c.kind === "note") {
            additionalNotes.push(c.content);
          }
        }

        if (links.length > 0) {
          enrichedSeed += `\n\nReference Links:\n${links.map(l => `- ${l}`).join("\n")}`;
        }
        if (additionalNotes.length > 0) {
          enrichedSeed += `\n\nAdditional Context:\n${additionalNotes.map(n => `- ${n}`).join("\n")}`;
        }

        // Update idea status
        await d1Exec(env, `UPDATE ideas SET status='processing', updated_at=? WHERE id=?`, [nowIso(), idea_id]);

        // Create project
        const project_name = idea.title || "untitled-project";
        const constraints = body.constraints || {};
        const project_id = await createProject(env, idea.user_id, project_name, enrichedSeed, constraints);

        // Link idea to project
        await d1Exec(env, `UPDATE ideas SET status='converted', project_id=?, updated_at=? WHERE id=?`, [project_id, nowIso(), idea_id]);

        // Now run brainstorm (but don't block on full pipeline)
        const providerNames = (body.providers as string[]) || ["workers_ai", "anthropic", "openai", "gemini", "grok", "openrouter"];
        const started_at = nowIso();
        const run_id = uuidv4();

        const tpl = await getPrompt(env, "BRAINSTORM");
        const prompt = renderTemplate(tpl, {
          IDEA_SEED: enrichedSeed,
          CONSTRAINTS_JSON: JSON.stringify(constraints),
        });

        const results = await brainstorm(env, { prompt, providerNames });

        await updateProjectStatus(env, project_id, "brainstormed");
        await logRun(env, {
          id: run_id,
          project_id,
          kind: "brainstorm",
          status: "ok",
          input_json: { idea_seed: enrichedSeed, constraints, providers: providerNames, from_idea: idea_id },
          output_json: { results },
          started_at,
          finished_at: nowIso(),
        });

        return json({
          ok: true,
          idea_id,
          project_id,
          status: "brainstormed",
          message: "Idea converted to project and brainstormed. Run /synthesize and /bootstrap to complete."
        });
      }

      // PATCH /ideas/:id - Update idea
      const patchIdeaMatch = url.pathname.match(/^\/ideas\/([^/]+)$/);
      if (patchIdeaMatch && req.method === "PATCH") {
        const idea_id = patchIdeaMatch[1];
        const body = await readJson(req) as Record<string, unknown>;

        const idea = await d1First(env, `SELECT id, status FROM ideas WHERE id=?`, [idea_id]);
        if (!idea) {
          return json({ ok: false, error: "idea not found" }, { status: 404 });
        }

        const updates: string[] = [];
        const params: (string | null)[] = [];

        if (body.title !== undefined) {
          updates.push("title=?");
          params.push(body.title ? String(body.title) : null);
        }
        if (body.idea_seed !== undefined) {
          updates.push("idea_seed=?");
          params.push(String(body.idea_seed));
        }
        if (body.notes !== undefined) {
          updates.push("notes=?");
          params.push(body.notes ? String(body.notes) : null);
        }

        if (updates.length === 0) {
          return json({ ok: false, error: "no updates provided" }, { status: 400 });
        }

        updates.push("updated_at=?");
        params.push(nowIso());
        params.push(idea_id);

        await d1Exec(env, `UPDATE ideas SET ${updates.join(", ")} WHERE id=?`, params);
        return json({ ok: true });
      }

      // DELETE /ideas/:id - Delete idea and its context
      const deleteIdeaMatch = url.pathname.match(/^\/ideas\/([^/]+)$/);
      if (deleteIdeaMatch && req.method === "DELETE") {
        const idea_id = deleteIdeaMatch[1];

        const idea = await d1First(env, `SELECT id FROM ideas WHERE id=?`, [idea_id]);
        if (!idea) {
          return json({ ok: false, error: "idea not found" }, { status: 404 });
        }

        await d1Exec(env, `DELETE FROM idea_context WHERE idea_id=?`, [idea_id]);
        await d1Exec(env, `DELETE FROM ideas WHERE id=?`, [idea_id]);

        return json({ ok: true });
      }

      // ============ Pipeline Endpoints ============

      // /brainstorm
      if (url.pathname === "/brainstorm" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const user_id = userIdFrom(body);

        const idea_seed = String(body.idea_seed || "");
        if (!idea_seed) return json({ ok: false, error: "idea_seed required" }, { status: 400 });

        const constraints = body.constraints || {};
        const project_name = String(body.project_name || "new-project");
        const providerNames = (body.providers as string[]) || ["workers_ai", "anthropic", "openai", "gemini", "grok", "openrouter"];

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

      // GET /projects/:id — get single project with docs
      const getProjectMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
      if (getProjectMatch && req.method === "GET") {
        const project_id = getProjectMatch[1];

        const project = await d1First<{
          id: string;
          name: string;
          idea_seed: string;
          status: string;
          created_at: string;
          updated_at: string;
        }>(env, `SELECT id, name, idea_seed, status, created_at, updated_at FROM projects WHERE id=?`, [project_id]);

        if (!project) {
          return json({ ok: false, error: "project not found" }, { status: 404 });
        }

        // Get docs from R2 if bootstrapped
        const docs: Record<string, string> = {};
        if (project.status === "bootstrapped") {
          const prefix = `projects/${project_id}/repo-pack/`;
          const objs = await r2ListPrefix(env, prefix);

          for (const obj of objs) {
            const r2Obj = await r2GetObject(env, obj.key);
            if (r2Obj) {
              const content = await r2Obj.text();
              const filename = obj.key.replace(prefix, "").replace(".md", "").toLowerCase();
              docs[filename] = content;
            }
          }
        }

        return json({ ok: true, project, docs });
      }

      // /download — returns combined markdown document
      if (url.pathname === "/download" && req.method === "POST") {
        const body = await readJson(req) as Record<string, unknown>;
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        // Get project info
        const project = await d1First<{ name: string; idea_seed: string }>(
          env,
          `SELECT name, idea_seed FROM projects WHERE id=?`,
          [project_id]
        );
        if (!project) return json({ ok: false, error: "project not found" }, { status: 404 });

        const prefix = `projects/${project_id}/repo-pack/`;
        const objs = await r2ListPrefix(env, prefix);

        // Collect all markdown content
        const docs: Record<string, string> = {};
        for (const o of objs) {
          const obj = await r2GetObject(env, o.key);
          if (!obj) continue;
          const content = await obj.text();
          const filename = o.key.replace(prefix, "").replace(".md", "").toUpperCase();
          docs[filename] = content;
        }

        // Combine into single markdown document
        const sections = ["THESIS", "ARCHITECTURE", "GO_NO_GO", "TASKS"];
        let combined = `# ${project.name}\n\n`;
        combined += `> ${project.idea_seed}\n\n`;
        combined += `---\n\n`;

        for (const section of sections) {
          if (docs[section]) {
            combined += docs[section];
            combined += `\n\n---\n\n`;
          }
        }

        // Add any other docs not in the standard sections
        for (const [key, content] of Object.entries(docs)) {
          if (!sections.includes(key)) {
            combined += content;
            combined += `\n\n---\n\n`;
          }
        }

        const filename = project.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
        return new Response(combined, {
          status: 200,
          headers: {
            "content-type": "text/markdown; charset=utf-8",
            "content-disposition": `attachment; filename=${filename}-project-pack.md`,
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          },
        });
      }

      // /projects — list all projects
      if (url.pathname === "/projects" && req.method === "GET") {
        const limit = parseInt(url.searchParams.get("limit") || "50", 10);
        const offset = parseInt(url.searchParams.get("offset") || "0", 10);
        const status = url.searchParams.get("status"); // optional filter

        let query = `SELECT id, name, idea_seed, status, created_at, updated_at FROM projects`;
        const params: (string | number)[] = [];

        if (status) {
          query += ` WHERE status = ?`;
          params.push(status);
        }

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        const result = await env.DB.prepare(query).bind(...params).all();
        const projects = result.results || [];

        // Get total count
        let countQuery = `SELECT COUNT(*) as total FROM projects`;
        if (status) {
          countQuery += ` WHERE status = ?`;
        }
        const countResult = await env.DB.prepare(countQuery).bind(...(status ? [status] : [])).first<{ total: number }>();
        const total = countResult?.total || 0;

        return json({
          ok: true,
          projects,
          pagination: { limit, offset, total }
        });
      }

      // PATCH /projects/:id — update project name
      const patchMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
      if (patchMatch && req.method === "PATCH") {
        const project_id = patchMatch[1];
        const body = await readJson(req) as Record<string, unknown>;
        const name = body.name as string;

        if (!name?.trim()) {
          return json({ ok: false, error: "name required" }, { status: 400 });
        }

        const project = await d1First(env, `SELECT id FROM projects WHERE id=?`, [project_id]);
        if (!project) {
          return json({ ok: false, error: "project not found" }, { status: 404 });
        }

        await d1Exec(env, `UPDATE projects SET name=?, updated_at=? WHERE id=?`, [name.trim(), nowIso(), project_id]);
        return json({ ok: true });
      }

      // DELETE /projects/:id — delete project and all associated data
      const deleteMatch = url.pathname.match(/^\/projects\/([^/]+)$/);
      if (deleteMatch && req.method === "DELETE") {
        const project_id = deleteMatch[1];

        const project = await d1First(env, `SELECT id FROM projects WHERE id=?`, [project_id]);
        if (!project) {
          return json({ ok: false, error: "project not found" }, { status: 404 });
        }

        // Delete from R2 (artifacts)
        const prefix = `projects/${project_id}/`;
        const objs = await r2ListPrefix(env, prefix);
        for (const obj of objs) {
          await env.ARTIFACTS.delete(obj.key);
        }

        // Delete from Vectorize (memory vectors)
        const memories = await env.DB.prepare(`SELECT id FROM memories WHERE project_id=?`).bind(project_id).all();
        const memoryIds = (memories.results || []).map((m: { id: string }) => m.id);
        if (memoryIds.length > 0) {
          await env.VEC.deleteByIds(memoryIds);
        }

        // Delete from D1 tables (order matters for foreign keys)
        await d1Exec(env, `DELETE FROM artifacts WHERE project_id=?`, [project_id]);
        await d1Exec(env, `DELETE FROM memory_vectors WHERE project_id=?`, [project_id]);
        await d1Exec(env, `DELETE FROM memories WHERE project_id=?`, [project_id]);
        await d1Exec(env, `DELETE FROM runs WHERE project_id=?`, [project_id]);
        await d1Exec(env, `DELETE FROM projects WHERE id=?`, [project_id]);

        return json({ ok: true });
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
