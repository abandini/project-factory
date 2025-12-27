# project-factory — MVP+ (Cloudflare-first, multi-AI, mem0-style memory)

This single markdown is designed to be **handed to Claude Code** so it can:
- create the GitHub repo `project-factory`
- scaffold all files exactly as below
- provision Cloudflare resources (D1, R2, KV, Vectorize) and bindings
- deploy the Worker

It includes:
- the **completed thesis** and **full architecture** for *project-factory itself*
- all repo files (copy/paste)
- **upgrades**: `/download` endpoint producing a `.tar.gz` repo-pack + **Anthropic provider implementation**
- a **kickoff prompt** you can paste into Claude Code to execute the build

---

## 0) Completed Thesis (project-factory)

### Problem
When building many apps, it’s easy to spend time in idea exploration without reliably converting the best ideas into **well-formed, rigorous, build-ready GitHub projects**.

### Hypothesis
A repeatable pipeline that separates **Exploration (multi-model brainstorming)** from **Execution (rigorous Orchestrator + roles + persistent memory)** will substantially increase:
- project throughput
- architectural consistency
- testability
- long-term reuse (via memory)

### Solution
**project-factory**: a Cloudflare-first service that accepts an idea seed + constraints and produces a standardized “repo-pack” (docs + prompts + backlog) while capturing durable memory.

### Unique Wedge
- **Cloudflare-native agent runtime** (Workers + Workers AI + D1 + R2 + Vectorize + KV + Secrets)
- **mem0-style memory** implemented with Vectorize semantic recall + D1 canonical store + optional reflection
- **role discipline** (Planner → Executor → Critic → Auditor)
- output is **directly actionable**: THESIS.md, ARCHITECTURE.md, GO_NO_GO.md, TASKS.md, plus prompts

### MVP Scope (≤7)
1) Endpoints: `/brainstorm`, `/synthesize`, `/bootstrap`, `/download`
2) Memory endpoints: `/memory/remember`, `/memory/recall`, `/memory/reflect`, `/memory/forget`
3) Multi-provider fan-out: Workers AI (default) + Anthropic (implemented); others stubbed
4) Repo-pack generator: writes markdown files into R2
5) Download packager: returns `.tar.gz` of repo-pack from R2
6) Canonical state/logging: D1 projects/runs/artifacts/memories
7) Prompts stored in KV (so prompts can be edited without redeploy)

### Success Metrics
- Time from idea seed → downloadable repo-pack: < 2 minutes
- Repo-pack completeness: 4/4 core docs always produced
- Memory reuse: recall returns relevant past decisions/constraints for subsequent projects

### Risks
- Model outputs may not be valid JSON → needs robust parsing/fallback
- Provider API changes → keep provider interface thin
- Too much memory (“everything stored”) → enforce policy + reflection

### Non-goals (MVP)
- GitHub App / automatic repo creation (Claude Code will handle this)
- UI (API-first)
- multi-user auth (schema supports user_id; MVP single-tenant default)

---

## 1) Full Architecture (project-factory)

### High-level flow
1) **brainstorm**
   - fan-out to models (Workers AI + Anthropic)
   - store raw outputs in D1 run logs + optionally in R2
   - store durable intent/constraints as memory

2) **synthesize**
   - Orchestrator produces a single coherent JSON: thesis + architecture + go/no-go + tasks + memory candidates
   - persist synthesis output as a run
   - write memory candidates to memory store

3) **bootstrap**
   - generate repo-pack files via a prompt
   - write files to R2 under `projects/<project_id>/repo-pack/...`
   - record artifacts in D1

4) **download**
   - list repo-pack objects in R2
   - stream a `tar.gz` with correct paths

### Components
- **Cloudflare Worker**
  - HTTP router + pipelines
  - tool wrappers for D1/R2/KV/Vectorize

- **Workers AI**
  - default text generation model
  - embedding generation (semantic memory)

- **Anthropic Provider**
  - optional for brainstorming/synthesis (via `ANTHROPIC_API_KEY` secret)

- **D1**
  - projects, runs, artifacts
  - canonical memories + vector pointers

- **Vectorize**
  - semantic index for recall

- **R2**
  - repo-pack files
  - logs/pack artifacts

- **KV**
  - prompts (editable without redeploy)

### Memory model (mem0-style)
- `remember`: store canonical memory item to D1, embed text, upsert to Vectorize
- `recall`: embed query, Vectorize query, then hydrate D1 rows
- `reflect`: summarize and create compressed high-signal memories
- `forget`: tombstone in D1 (Vectorize deletion optional later)

### Security
- Secrets only in Cloudflare Secrets; never stored in D1/R2
- Memory policy blocks “secret-like” content
- No destructive actions by default

### Observability
- D1 `runs` table tracks each pipeline step with input/output
- Each endpoint returns logs and IDs for traceability

---

## 2) Repo tree

```text
project-factory/
  README.md
  wrangler.jsonc
  package.json
  tsconfig.json

  sql/schema.sql

  prompts/
    ORCHESTRATOR.txt
    ROLES.txt
    THESIS.template.md
    ARCHITECTURE.template.md
    GO_NO_GO.template.md
    TASKS.template.md
    BRAINSTORM.prompt.txt
    SYNTHESIZE.prompt.txt
    BOOTSTRAP.prompt.txt

  src/
    worker.ts

    core/
      logger.ts
      state.ts
      tools.ts
      roles.ts
      orchestrator.ts
      artifacts.ts
      util.ts
      tar.ts

    memory/
      policy.ts
      store_d1.ts
      vectorize.ts
      memory.ts
      reflect.ts

    providers/
      provider.ts
      workers_ai.ts
      anthropic.ts
      openai.ts
      gemini.ts
      grok.ts

    pipelines/
      brainstorm.ts
      synthesize.ts
      bootstrap_repo.ts

  .github/
    workflows/
      deploy.yml
```

---

## 3) Files

### 3.1 README.md

```md
# project-factory (MVP+)

A Cloudflare-first “idea → rigorous repo pack” factory.

## What it does
POST an idea seed and constraints, and it will:
1) Brainstorm using multiple LLM providers (Workers AI default; Anthropic implemented; others optional)
2) Synthesize into a single coherent set of docs:
   - THESIS.md
   - ARCHITECTURE.md
   - GO_NO_GO.md
   - TASKS.md (GitHub-issue-ready backlog)
3) Persist artifacts to R2 and index key memories for future reuse (mem0-style memory):
   - remember / recall / reflect / forget
   - D1 for canonical memory + audit
   - Vectorize for semantic recall
4) Maintain rigorous agent roles:
   - Orchestrator + Planner + Executor + Critic + Auditor
5) Package and download the repo-pack as a `.tar.gz` via `/download`

## Endpoints
- POST /brainstorm
- POST /synthesize
- POST /bootstrap
- POST /download
- POST /memory/remember
- POST /memory/recall
- POST /memory/reflect
- POST /memory/forget

## Cloudflare bindings used
- Workers AI (AI)
- D1 (DB)
- Vectorize (VEC)
- R2 (ARTIFACTS)
- KV (KV)
- Secrets (optional provider keys)

## Optional secrets
- wrangler secret put ANTHROPIC_API_KEY
- wrangler secret put OPENAI_API_KEY
- wrangler secret put GEMINI_API_KEY
- wrangler secret put GROK_API_KEY

## Setup
1) Create Cloudflare resources: D1, R2, KV, Vectorize
2) Put IDs into wrangler.jsonc
3) Apply schema:
   wrangler d1 execute project_factory --file=./sql/schema.sql
4) Load prompts into KV (recommended):
   wrangler kv:key put --binding KV "prompts:BRAINSTORM" --path ./prompts/BRAINSTORM.prompt.txt
   wrangler kv:key put --binding KV "prompts:SYNTHESIZE" --path ./prompts/SYNTHESIZE.prompt.txt
   wrangler kv:key put --binding KV "prompts:BOOTSTRAP" --path ./prompts/BOOTSTRAP.prompt.txt
5) Deploy:
   wrangler deploy

## Test
- POST /brainstorm { idea_seed, constraints }
- POST /synthesize { project_id }
- POST /bootstrap { project_id }
- POST /download { project_id }
```

---

### 3.2 wrangler.jsonc

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "project-factory",
  "main": "src/worker.ts",
  "compatibility_date": "2025-12-27",

  "ai": { "binding": "AI" },

  "d1_databases": [
    { "binding": "DB", "database_name": "project_factory", "database_id": "REPLACE_ME" }
  ],

  "vectorize": [
    { "binding": "VEC", "index_name": "pf-memory" }
  ],

  "r2_buckets": [
    { "binding": "ARTIFACTS", "bucket_name": "project-factory-artifacts" }
  ],

  "kv_namespaces": [
    { "binding": "KV", "id": "REPLACE_ME" }
  ]
}
```

---

### 3.3 package.json

```json
{
  "name": "project-factory",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "d1:schema": "wrangler d1 execute project_factory --file=./sql/schema.sql"
  },
  "dependencies": {
    "uuid": "^9.0.1"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20251201.0",
    "typescript": "^5.6.3"
  }
}
```

---

### 3.4 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ES2022",
    "moduleResolution": "Bundler",
    "strict": true,
    "types": ["@cloudflare/workers-types"],
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

---

### 3.5 sql/schema.sql

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  idea_seed TEXT NOT NULL,
  constraints_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL,
  input_json TEXT NOT NULL,
  output_json TEXT,
  error_text TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  sha256 TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  salience REAL NOT NULL DEFAULT 0.5,
  source TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS memory_vectors (
  memory_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  project_id TEXT,
  vector_id TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (memory_id) REFERENCES memories(id)
);

CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_memories_project ON memories(project_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_runs_project ON runs(project_id, kind);
```

---

## 4) Prompts

### prompts/ORCHESTRATOR.txt

```text
You are Orchestrator, a production-grade agent controller.

CORE IDEA
- Convert “idea exploration” into “well-formed GitHub projects.”
- Exploration can be multi-model and wide-ranging.
- Execution must be rigorous, planful, and auditable.

NON-NEGOTIABLES
1) Tool-first: fetch/compute/verify instead of guessing.
2) Externalized state: persist canonical state in DB/KV/R2, not chat history.
3) Role discipline: Planner → Executor → Critic → Auditor.
4) Memory: mem0-style remember/recall/reflect/forget.
5) Output files are usable repo pack:
   THESIS.md, ARCHITECTURE.md, GO_NO_GO.md, TASKS.md.

OUTPUT SHAPE
PLAN (3–7 steps)
ACTIONS
STATE UPDATE
CHECKS
NEXT

SAFETY / QUALITY
- Do not fabricate integrations.
- If an external provider key is missing, fall back to Workers AI.
- Do not perform destructive actions without explicit confirmation.
- Tasks must have acceptance criteria.
```

### prompts/ROLES.txt

```text
Planner: minimal plan + success criteria. No tools.
Executor: execute plan, create artifacts, persist them.
Critic: validate consistency/completeness; demand fixes.
Auditor: secrets hygiene; policy enforcement; block unsafe actions.
```

### prompts/BRAINSTORM.prompt.txt

```text
You are brainstorming product and engineering directions.
Return JSON:
{
  "angles": [ { "title": "...", "description": "...", "why_it_works": "..."} ],
  "risks": ["..."],
  "killer_features": ["..."],
  "mvp_scope": ["... (<=7)"],
  "questions": ["..."]
}

IDEA_SEED:
{{IDEA_SEED}}

CONSTRAINTS_JSON:
{{CONSTRAINTS_JSON}}
```

### prompts/SYNTHESIZE.prompt.txt

```text
Synthesize brainstorm into one coherent plan.
Return JSON:
{
  "project_name": "...",
  "thesis": {
    "icp": "...",
    "problem": "...",
    "why_now": "...",
    "wedge": "...",
    "mvp_scope": ["..."],
    "success_metrics": ["..."],
    "risks": ["..."],
    "non_goals": ["..."]
  },
  "architecture": {
    "overview": "...",
    "data_flow": "...",
    "memory_design": "...",
    "security": "...",
    "observability": "...",
    "future": "..."
  },
  "go_no_go": {
    "stop_conditions": ["..."],
    "budget": "...",
    "risk_mitigations": ["..."],
    "decision": "GO|NO_GO"
  },
  "tasks": [
    {"title":"...","acceptance":"...","priority":"P0|P1|P2"}
  ],
  "memory_candidates": [
     {"kind":"decision|preference|fact|note","text":"...","tags":["..."],"salience":0.0}
  ]
}

IDEA_SEED:
{{IDEA_SEED}}

CONSTRAINTS_JSON:
{{CONSTRAINTS_JSON}}

BRAINSTORM_PACKET_JSON:
{{BRAINSTORM_PACKET_JSON}}
```

### prompts/BOOTSTRAP.prompt.txt

```text
Generate repo pack markdown files from synthesized JSON.
Return JSON:
{
  "files": [
    {"path":"THESIS.md","content":"..."},
    {"path":"ARCHITECTURE.md","content":"..."},
    {"path":"GO_NO_GO.md","content":"..."},
    {"path":"TASKS.md","content":"..."}
  ]
}

SYNTHESIZED_JSON:
{{SYNTHESIZED_JSON}}
```

---

## 5) Source code

### src/core/util.ts

```ts
export const nowIso = () => new Date().toISOString();

export function json<T = any>(obj: T, init?: ResponseInit): Response {
  return new Response(JSON.stringify(obj, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init?.headers || {}),
    },
  });
}

export async function readJson(req: Request): Promise<any> {
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

export function renderTemplate(tpl: string, vars: Record<string, string>) {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}
```

### src/core/logger.ts

```ts
export type LogEvent = { ts: string; level: "info" | "warn" | "error"; msg: string; meta?: any };

export function makeLogger() {
  const events: LogEvent[] = [];
  return {
    info(msg: string, meta?: any) {
      events.push({ ts: new Date().toISOString(), level: "info", msg, meta });
    },
    warn(msg: string, meta?: any) {
      events.push({ ts: new Date().toISOString(), level: "warn", msg, meta });
    },
    error(msg: string, meta?: any) {
      events.push({ ts: new Date().toISOString(), level: "error", msg, meta });
    },
    events,
  };
}
```

### src/core/state.ts

```ts
export type AgentStatus = "created" | "brainstormed" | "synthesized" | "bootstrapped" | "blocked";

export type Env = {
  DB: D1Database;
  KV: KVNamespace;
  VEC: VectorizeIndex;
  ARTIFACTS: R2Bucket;
  AI: any;

  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROK_API_KEY?: string;
};

export const DEFAULT_USER_ID = "bill";
```

### src/core/tools.ts

```ts
import { Env } from "./state";

export async function d1Exec(env: Env, sql: string, params: any[] = []) {
  const stmt = env.DB.prepare(sql);
  const res = params.length ? await stmt.bind(...params).run() : await stmt.run();
  return res;
}

export async function d1All<T = any>(env: Env, sql: string, params: any[] = []): Promise<T[]> {
  const stmt = env.DB.prepare(sql);
  const res = params.length ? await stmt.bind(...params).all() : await stmt.all();
  return (res.results || []) as T[];
}

export async function d1First<T = any>(env: Env, sql: string, params: any[] = []): Promise<T | null> {
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
```

### src/core/artifacts.ts

```ts
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
```

### src/core/orchestrator.ts

```ts
import { Env } from "./state";
import { makeLogger } from "./logger";

export function makeOrchestrator(_env: Env) {
  const log = makeLogger();
  return {
    log,
    async run<T>(fn: () => Promise<T>): Promise<{ result?: T; error?: string; logs: any[] }> {
      try {
        const result = await fn();
        return { result, logs: log.events };
      } catch (e: any) {
        return { error: String(e?.message || e), logs: log.events };
      }
    },
  };
}
```

---

## 6) Upgrade 1 — tar.gz packager

### src/core/tar.ts

```ts
// Minimal tar writer + gzip using CompressionStream (available in Workers)
// Supports regular files only.

function padTo512(n: number) {
  return (512 - (n % 512)) % 512;
}

function writeOctal(value: number, length: number) {
  const s = value.toString(8);
  return s.padStart(length - 1, "0") + "\0";
}

function asciiBytes(s: string, len: number) {
  const enc = new TextEncoder();
  const b = enc.encode(s);
  const out = new Uint8Array(len);
  out.set(b.slice(0, len));
  return out;
}

function tarHeader(path: string, size: number, mtime: number) {
  // POSIX ustar header 512 bytes
  const header = new Uint8Array(512);

  // name (0-99)
  header.set(asciiBytes(path, 100), 0);

  // mode (100-107)
  header.set(asciiBytes(writeOctal(0o644, 8), 8), 100);

  // uid/gid
  header.set(asciiBytes(writeOctal(0, 8), 8), 108);
  header.set(asciiBytes(writeOctal(0, 8), 8), 116);

  // size
  header.set(asciiBytes(writeOctal(size, 12), 12), 124);

  // mtime
  header.set(asciiBytes(writeOctal(mtime, 12), 12), 136);

  // checksum field initially spaces
  for (let i = 148; i < 156; i++) header[i] = 0x20;

  // typeflag '0'
  header[156] = "0".charCodeAt(0);

  // magic + version
  header.set(asciiBytes("ustar\0", 6), 257);
  header.set(asciiBytes("00", 2), 263);

  // uname/gname
  header.set(asciiBytes("worker", 32), 265);
  header.set(asciiBytes("worker", 32), 297);

  // checksum
  let sum = 0;
  for (let i = 0; i < 512; i++) sum += header[i];
  const chk = writeOctal(sum, 8);
  header.set(asciiBytes(chk, 8), 148);

  return header;
}

export async function makeTarGz(files: Array<{ path: string; data: Uint8Array }>): Promise<ReadableStream<Uint8Array>> {
  const tarChunks: Uint8Array[] = [];

  const mtime = Math.floor(Date.now() / 1000);

  for (const f of files) {
    const header = tarHeader(f.path, f.data.byteLength, mtime);
    tarChunks.push(header);
    tarChunks.push(f.data);

    const pad = padTo512(f.data.byteLength);
    if (pad) tarChunks.push(new Uint8Array(pad));
  }

  // Two 512-byte blocks of zeros terminate tar
  tarChunks.push(new Uint8Array(1024));

  const tarStream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of tarChunks) controller.enqueue(c);
      controller.close();
    },
  });

  // gzip
  const cs = new CompressionStream("gzip");
  return tarStream.pipeThrough(cs);
}
```

---

## 7) Upgrade 2 — Anthropic provider (implemented)

### src/providers/provider.ts

```ts
import { Env } from "../core/state";

export type ProviderName = "workers_ai" | "anthropic" | "openai" | "gemini" | "grok";

export type LLMResult = { provider: ProviderName; text: string; raw?: any };

export interface Provider {
  name: ProviderName;
  isConfigured(env: Env): boolean;
  generate(env: Env, prompt: string): Promise<LLMResult>;
}
```

### src/providers/workers_ai.ts

```ts
import { Provider } from "./provider";
import { Env } from "../core/state";

export const WorkersAIProvider: Provider = {
  name: "workers_ai",
  isConfigured: (_env: Env) => true,
  async generate(env: Env, prompt: string) {
    const out = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", { prompt });
    const text = out?.response ?? out?.text ?? JSON.stringify(out);
    return { provider: "workers_ai", text, raw: out };
  },
};
```

### src/providers/anthropic.ts

```ts
import { Provider } from "./provider";
import { Env } from "../core/state";

// Anthropic Messages API (basic implementation)
export const AnthropicProvider: Provider = {
  name: "anthropic",
  isConfigured: (env: Env) => Boolean(env.ANTHROPIC_API_KEY),
  async generate(env: Env, prompt: string) {
    if (!env.ANTHROPIC_API_KEY) {
      return { provider: "anthropic", text: "ANTHROPIC_NOT_CONFIGURED" };
    }

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1200,
        temperature: 0.4,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = raw?.error?.message || JSON.stringify(raw);
      return { provider: "anthropic", text: `ANTHROPIC_ERROR: ${msg}`, raw };
    }

    // content: [{type:"text", text:"..."}, ...]
    const text = Array.isArray(raw?.content)
      ? raw.content.map((c: any) => (c?.type === "text" ? c.text : "")).join("\n").trim()
      : "";

    return { provider: "anthropic", text: text || JSON.stringify(raw), raw };
  },
};
```

### src/providers/openai.ts (stub)

```ts
import { Provider } from "./provider";
import { Env } from "../core/state";

export const OpenAIProvider: Provider = {
  name: "openai",
  isConfigured: (env: Env) => Boolean(env.OPENAI_API_KEY),
  async generate(_env: Env, _prompt: string) {
    return { provider: "openai", text: "OPENAI_NOT_IMPLEMENTED" };
  },
};
```

### src/providers/gemini.ts (stub)

```ts
import { Provider } from "./provider";
import { Env } from "../core/state";

export const GeminiProvider: Provider = {
  name: "gemini",
  isConfigured: (env: Env) => Boolean(env.GEMINI_API_KEY),
  async generate(_env: Env, _prompt: string) {
    return { provider: "gemini", text: "GEMINI_NOT_IMPLEMENTED" };
  },
};
```

### src/providers/grok.ts (stub)

```ts
import { Provider } from "./provider";
import { Env } from "../core/state";

export const GrokProvider: Provider = {
  name: "grok",
  isConfigured: (env: Env) => Boolean(env.GROK_API_KEY),
  async generate(_env: Env, _prompt: string) {
    return { provider: "grok", text: "GROK_NOT_IMPLEMENTED" };
  },
};
```

---

## 8) Pipelines (updated to include Anthropic)

### src/pipelines/brainstorm.ts

```ts
import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";
import { OpenAIProvider } from "../providers/openai";
import { GeminiProvider } from "../providers/gemini";
import { GrokProvider } from "../providers/grok";

const providers = [WorkersAIProvider, AnthropicProvider, OpenAIProvider, GeminiProvider, GrokProvider];

export async function brainstorm(env: Env, args: { prompt: string; providerNames?: string[] }) {
  const wanted = new Set((args.providerNames && args.providerNames.length) ? args.providerNames : ["workers_ai"]);

  const results: any[] = [];
  for (const p of providers) {
    if (!wanted.has(p.name)) continue;
    if (!p.isConfigured(env) && p.name !== "workers_ai") continue;
    const r = await p.generate(env, args.prompt);
    results.push(r);
  }
  return results;
}
```

### src/pipelines/synthesize.ts

```ts
import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";

export async function synthesize(env: Env, prompt: string, prefer: "anthropic" | "workers_ai" = "workers_ai") {
  const provider = (prefer === "anthropic" && AnthropicProvider.isConfigured(env)) ? AnthropicProvider : WorkersAIProvider;
  const r = await provider.generate(env, prompt);

  let obj: any = null;
  try {
    obj = JSON.parse(r.text);
  } catch {
    obj = { error: "SYNTHESIS_JSON_PARSE_FAILED", raw: r.text, provider: r.provider };
  }
  return { provider: r.provider, rawText: r.text, json: obj };
}
```

### src/pipelines/bootstrap_repo.ts

```ts
import { Env } from "../core/state";
import { WorkersAIProvider } from "../providers/workers_ai";
import { AnthropicProvider } from "../providers/anthropic";

export async function bootstrapRepo(env: Env, prompt: string, prefer: "anthropic" | "workers_ai" = "workers_ai") {
  const provider = (prefer === "anthropic" && AnthropicProvider.isConfigured(env)) ? AnthropicProvider : WorkersAIProvider;
  const r = await provider.generate(env, prompt);

  let obj: any = null;
  try {
    obj = JSON.parse(r.text);
  } catch {
    obj = { error: "BOOTSTRAP_JSON_PARSE_FAILED", raw: r.text, provider: r.provider };
  }
  return { provider: r.provider, rawText: r.text, json: obj };
}
```

---

## 9) Memory layer

### src/memory/policy.ts

```ts
export function allowMemory(text: string): { allowed: boolean; reason?: string } {
  const lowered = text.toLowerCase();
  const forbidden = ["api key", "password", "secret", "private key", "ssn"];
  if (forbidden.some(f => lowered.includes(f))) {
    return { allowed: false, reason: "Contains sensitive secret-like content." };
  }
  return { allowed: true };
}
```

### src/memory/store_d1.ts

```ts
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
```

### src/memory/vectorize.ts

```ts
import { Env } from "../core/state";
import { d1Exec } from "../core/tools";
import { nowIso } from "../core/util";

export async function embed(env: Env, text: string): Promise<number[]> {
  const res = await env.AI.run("@cf/baai/bge-base-en-v1.5", { text });
  const vec = res?.data?.[0]?.embedding;
  if (!vec) throw new Error("Embedding failed (no vector returned).");
  return vec as number[];
}

export async function upsertVector(env: Env, args: {
  vector_id: string;
  values: number[];
  metadata: Record<string, any>;
}) {
  await env.VEC.upsert([{ id: args.vector_id, values: args.values, metadata: args.metadata }]);
}

export async function queryVectors(env: Env, args: {
  query_values: number[];
  topK: number;
  filter?: Record<string, any>;
}) {
  const res = await env.VEC.query(args.query_values, { topK: args.topK, filter: args.filter });
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
```

### src/memory/memory.ts

```ts
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
  const matches = await queryVectors(env, {
    query_values: vec,
    topK: args.k ?? 8,
    filter: args.project_id ? { user_id: args.user_id, project_id: args.project_id } : { user_id: args.user_id },
  });

  const memoryIds = matches.map((m: any) => String(m.id).replace(/^mem:/, ""));
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
```

### src/memory/reflect.ts

```ts
import { Env } from "../core/state";
import { listRecentMemories } from "./store_d1";
import { remember } from "./memory";

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
  const text = out?.response ?? out?.text ?? JSON.stringify(out);

  let arr: any[] = [];
  try { arr = JSON.parse(text); } catch { arr = []; }

  const created: string[] = [];
  for (const m of arr.slice(0, 3)) {
    if (!m?.text) continue;
    const id = await remember(env, {
      user_id: args.user_id,
      project_id: args.project_id ?? null,
      kind: (m.kind || "note"),
      text: String(m.text),
      tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
      salience: typeof m.salience === "number" ? m.salience : 0.7,
      source: "agent",
    } as any);
    created.push(id);
  }

  return { ok: true, created };
}
```

---

## 10) Worker API (includes /download)

### src/worker.ts

```ts
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

import { remember, recall, forget } from "./memory/memory";
import { reflect } from "./memory/reflect";

async function getPrompt(env: Env, name: string): Promise<string> {
  const kv = await env.KV.get(`prompts:${name}`);
  if (kv) return kv;
  if (name === "BRAINSTORM") return "Return JSON brainstorm. IDEA_SEED={{IDEA_SEED}} CONSTRAINTS_JSON={{CONSTRAINTS_JSON}}";
  if (name === "SYNTHESIZE") return "Return JSON with thesis, architecture, go_no_go, tasks, memory_candidates.";
  if (name === "BOOTSTRAP") return "Return JSON with files: [{path,content}].";
  return "";
}

function userIdFrom(body: any) {
  return String(body.user_id || DEFAULT_USER_ID);
}

async function createProject(env: Env, user_id: string, name: string, idea_seed: string, constraints: any) {
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
  input_json: any;
  output_json?: any;
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
        const body = await readJson(req);
        const id = await remember(env, {
          user_id: userIdFrom(body),
          project_id: body.project_id ?? null,
          kind: body.kind,
          text: body.text,
          tags: body.tags || [],
          salience: body.salience ?? 0.6,
          source: body.source ?? "user",
        } as any);
        return json({ ok: true, id });
      }

      if (url.pathname === "/memory/recall" && req.method === "POST") {
        const body = await readJson(req);
        const items = await recall(env, {
          user_id: userIdFrom(body),
          project_id: body.project_id ?? null,
          query: body.query,
          k: body.k ?? 8,
        });
        return json({ ok: true, items });
      }

      if (url.pathname === "/memory/reflect" && req.method === "POST") {
        const body = await readJson(req);
        const out = await reflect(env, { user_id: userIdFrom(body), project_id: body.project_id ?? null });
        return json({ ok: true, ...out });
      }

      if (url.pathname === "/memory/forget" && req.method === "POST") {
        const body = await readJson(req);
        await forget(env, body.memory_id);
        return json({ ok: true });
      }

      // /brainstorm
      if (url.pathname === "/brainstorm" && req.method === "POST") {
        const body = await readJson(req);
        const user_id = userIdFrom(body);

        const idea_seed = String(body.idea_seed || "");
        if (!idea_seed) return json({ ok: false, error: "idea_seed required" }, { status: 400 });

        const constraints = body.constraints || {};
        const project_name = String(body.project_name || "new-project");
        const providerNames = body.providers || ["workers_ai", "anthropic", "openai", "gemini", "grok"];

        const project_id = body.project_id || (await createProject(env, user_id, project_name, idea_seed, constraints));
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
          text: "Project intent: convert idea exploration into a rigorous repo pack on Cloudflare (Workers, AI, D1, Vectorize, R2, Secrets), with GitHub as system of record.",
          tags: ["project-factory", "intent", "cloudflare", "github"],
          salience: 0.95,
          source: "system",
        } as any);

        await remember(env, {
          user_id,
          project_id,
          kind: "fact",
          text: `Idea seed: ${idea_seed}`,
          tags: ["idea-seed"],
          salience: 0.85,
          source: "user",
        } as any);

        return json({ ok: true, project_id, results, logs: orch.log.events });
      }

      // /synthesize
      if (url.pathname === "/synthesize" && req.method === "POST") {
        const body = await readJson(req);
        const user_id = userIdFrom(body);
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        const project = await d1First<any>(env, `SELECT * FROM projects WHERE id=?`, [project_id]);
        if (!project) return json({ ok: false, error: "project not found" }, { status: 404 });

        const started_at = nowIso();
        const run_id = uuidv4();

        const runRows = await env.DB.prepare(
          `SELECT * FROM runs WHERE project_id=? AND kind='brainstorm' ORDER BY started_at DESC LIMIT 1`
        )
          .bind(project_id)
          .all();

        const last = runRows.results?.[0] as any;
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
        await logRun(env, {
          id: run_id,
          project_id,
          kind: "synthesize",
          status: out.json?.error ? "error" : "ok",
          input_json: { prompt_meta: "SYNTHESIZE", project_id, prefer: "anthropic" },
          output_json: out,
          error_text: out.json?.error ? String(out.json.error) : undefined,
          started_at,
          finished_at: nowIso(),
        });

        const candidates = out.json?.memory_candidates;
        if (Array.isArray(candidates)) {
          for (const c of candidates.slice(0, 12)) {
            if (!c?.text) continue;
            await remember(env, {
              user_id,
              project_id,
              kind: c.kind || "note",
              text: String(c.text),
              tags: Array.isArray(c.tags) ? c.tags.map(String) : [],
              salience: typeof c.salience === "number" ? c.salience : 0.7,
              source: "agent",
            } as any);
          }
        }

        return json({ ok: true, project_id, synthesized: out.json, raw: out.rawText, provider: out.provider });
      }

      // /bootstrap
      if (url.pathname === "/bootstrap" && req.method === "POST") {
        const body = await readJson(req);
        const user_id = userIdFrom(body);
        const project_id = String(body.project_id || "");
        if (!project_id) return json({ ok: false, error: "project_id required" }, { status: 400 });

        const runs = await env.DB.prepare(
          `SELECT * FROM runs WHERE project_id=? AND kind='synthesize' ORDER BY started_at DESC LIMIT 1`
        )
          .bind(project_id)
          .all();

        const last = runs.results?.[0] as any;
        if (!last?.output_json) return json({ ok: false, error: "No synthesis found" }, { status: 400 });

        const synthObj = JSON.parse(last.output_json);
        const synthesized = synthObj?.json ?? synthObj;

        const started_at = nowIso();
        const run_id = uuidv4();

        const tpl = await getPrompt(env, "BOOTSTRAP");
        const prompt = renderTemplate(tpl, {
          SYNTHESIZED_JSON: JSON.stringify(synthesized),
        });

        // prefer Anthropic for bootstrap if configured
        const out = await bootstrapRepo(env, prompt, "anthropic");

        const files = out.json?.files;
        const stored: any[] = [];

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
          status: out.json?.error ? "error" : "ok",
          input_json: { prompt_meta: "BOOTSTRAP", prefer: "anthropic" },
          output_json: { stored, raw: out.rawText, provider: out.provider },
          error_text: out.json?.error ? String(out.json.error) : undefined,
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
        } as any);

        return json({ ok: true, project_id, stored, provider: out.provider });
      }

      // /download — returns .tar.gz of repo-pack
      if (url.pathname === "/download" && req.method === "POST") {
        const body = await readJson(req);
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
    } catch (e: any) {
      return json({ ok: false, error: String(e?.message || e) }, { status: 500 });
    }
  },
};
```

---

## 11) GitHub Actions deploy (optional)

### .github/workflows/deploy.yml

```yml
name: Deploy Worker

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## 12) Kickoff prompt for Claude Code (paste this)

```text
You are Claude Code with full access to my GitHub and Cloudflare.

MISSION
Build and deploy the MVP+ system described in the provided markdown spec “project-factory — MVP+”.

OUTCOME
A GitHub repo named: project-factory
A deployed Cloudflare Worker with bindings to D1, R2, KV, Vectorize, and Workers AI.
The Worker must expose endpoints:
- POST /brainstorm
- POST /synthesize
- POST /bootstrap
- POST /download  (returns .tar.gz)
- POST /memory/remember
- POST /memory/recall
- POST /memory/reflect
- POST /memory/forget

DEFAULTS
- Single tenant default user_id = "bill" but allow overriding by request body.
- Prompts are loaded from KV keys:
  prompts:BRAINSTORM
  prompts:SYNTHESIZE
  prompts:BOOTSTRAP

REQUIREMENTS
1) Create the repo structure and files exactly as specified.
2) Provision Cloudflare resources:
   - D1 database `project_factory`
   - R2 bucket `project-factory-artifacts`
   - KV namespace for prompts
   - Vectorize index `pf-memory`
   - Worker AI binding `AI`
3) Update wrangler.jsonc with real IDs.
4) Apply D1 schema using sql/schema.sql.
5) Upload prompt files into KV.
6) Deploy the Worker.
7) Smoke test:
   - /brainstorm with providers ["workers_ai"]
   - /synthesize and /bootstrap
   - /download returns a valid tar.gz containing THESIS.md etc.
   - /memory/remember + /memory/recall roundtrip

QUALITY GATES
- No secrets stored in D1/R2.
- Memory policy blocks secret-like content.
- Robust JSON parsing with fallback errors is acceptable for MVP.

DELIVER
- Repo URL
- Worker URL
- Example curl commands for the full pipeline
```

---

## 13) Example curl pipeline

```bash
# 1) Brainstorm
curl -X POST $WORKER_URL/brainstorm \
  -H "content-type: application/json" \
  -d '{
    "project_name":"demo",
    "idea_seed":"Create a tool that uses multiple AIs to brainstorm ideas then rigorously turns the best idea into a well-formed GitHub project using orchestrator roles and Cloudflare primitives.",
    "constraints":{"stack":"cloudflare","storage":["d1","r2","vectorize","kv"],"memory":"mem0-style"},
    "providers":["workers_ai","anthropic"]
  }'

# 2) Synthesize
curl -X POST $WORKER_URL/synthesize \
  -H "content-type: application/json" \
  -d '{"project_id":"PASTE_PROJECT_ID"}'

# 3) Bootstrap
curl -X POST $WORKER_URL/bootstrap \
  -H "content-type: application/json" \
  -d '{"project_id":"PASTE_PROJECT_ID"}'

# 4) Download repo-pack as tar.gz
curl -X POST $WORKER_URL/download \
  -H "content-type: application/json" \
  -d '{"project_id":"PASTE_PROJECT_ID"}' \
  --output repo-pack.tar.gz
```

---

## Notes / expected MVP behavior
- If Anthropic key is not configured, synthesis/bootstrap will fall back to Workers AI.
- If the model returns invalid JSON, endpoints will return `error: *_JSON_PARSE_FAILED` along with `raw` text.
- Vector deletion on forget is not implemented in MVP (D1 tombstone is sufficient).

