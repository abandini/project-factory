# project-factory (MVP+)

A Cloudflare-first "idea → rigorous repo pack" factory.

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
