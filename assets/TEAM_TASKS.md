# Team Task Distribution — 3 People (Frontend excluded)

> Frontend lives in Lovable and is owned outside this split. The three roles below cover **agents/LLM**, **retrieval/data**, and **infra/learning-loop**. Each owns clear interfaces so work is parallel.

---

## Shared contract (agree in hour 1, then never argue again)

- **Plan JSON schema** in `packages/shared/types.ts` — single source of truth.
- **All endpoints** under `/api/*` on Vercel, return strict `Plan` or `PlanPatch`.
- **All agents** are pure functions: `(input, context) => SectionJSON` with `citations[]`.
- **All retrieval** goes through one `tavilyClient` wrapper — no direct fetches.
- **DB access** only through `packages/db/` — no raw SQL in route handlers.

Daily 10-min sync: blockers, schema changes, demo-readiness check.

---

## Person A — **Agent / LLM Lead** ("the brain")

**Goal:** turn a hypothesis into a high-quality, internally consistent Plan JSON.

### Owns
- Prompt engineering for all 6 agents (Protocol, Materials, Budget, Timeline, Validation, Lead PI).
- Multi-agent orchestrator (parallel fan-out + Lead PI consistency pass).
- LLM provider wrapper (`packages/llm/`) — OpenAI/Anthropic switchable, streaming, retries, JSON-mode.
- Output validation against the shared Zod schema; auto-repair on schema fail.
- Few-shot injection logic (consumes corrections from Person C's vector store).

### Deliverables
1. `packages/llm/client.ts` — streaming JSON LLM client with schema-guard.
2. `agents/protocol.ts`, `materials.ts`, `budget.ts`, `timeline.ts`, `validation.ts`, `leadPI.ts`.
3. `POST /api/plan` — orchestrates all agents, streams sections back as they complete.
4. `POST /api/regenerate` — same as `/plan` but pulls correction few-shots from vector store.
5. Eval harness `scripts/eval.ts` running all 4 brief sample inputs → schema + citation checks.

### Definition of done
- All 4 brief samples produce a valid Plan in < 60s.
- Every protocol step, reagent, and budget line has at least one citation URL.
- Lead PI agent rejects plans where timeline doesn't cover all protocol steps or budget misses a reagent.

---

## Person B — **Retrieval / Domain Data Lead** ("the librarian")

**Goal:** make every claim grounded and every catalog number resolve.

### Owns
- Tavily client wrapper with per-domain query profiles (`packages/retrieval/`).
- Source-restricted searchers: `protocols`, `suppliers`, `papers`, `cellLines`.
- Catalog number validation (URL must 200 + page contains the catalog #).
- Novelty QC pipeline: query → similarity scoring → bin into `not_found | similar_work_exists | exact_match`.
- Domain/experiment-type tagger (used by Person C for correction lookup keys).
- Hypothesis cache (sha256 → cached results) in Postgres.

### Deliverables
1. `packages/retrieval/tavily.ts` — typed wrapper, per-profile rate limiting.
2. `packages/retrieval/profiles.ts` — domain allow-lists:
   - protocols: `protocols.io, bio-protocol.org, nature.com/nprot, jove.com, openwetware.org`
   - suppliers: `sigmaaldrich.com, thermofisher.com, addgene.org, atcc.org, tcichemicals.com, alfa.com, promega.com, qiagen.com, idtdna.com`
   - papers: `arxiv.org, semanticscholar.org, pubmed.ncbi.nlm.nih.gov, biorxiv.org`
3. `POST /api/qc` — novelty endpoint returning signal + 1–3 refs.
4. `packages/retrieval/validateCatalog.ts` — head-fetch + content check for every reagent line.
5. `packages/retrieval/classify.ts` — `(hypothesis) => { domain, experiment_type }`.

### Definition of done
- Novelty endpoint returns in < 8s for any of the 4 samples.
- 100% of catalog numbers in a generated plan resolve to a live supplier page in CI.
- Tavily calls cached and rate-limited; no provider 429s during demo.

---

## Person C — **Infra / Learning Loop Lead** ("the platform")

**Goal:** ship the stretch goal — corrections that visibly change the next plan.

### Owns
- Vercel project, env vars, Postgres + pgvector setup, deployment.
- DB schema, migrations, repository layer (`packages/db/`).
- Feedback ingestion + embedding + vector search.
- Plan versioning + diff computation.
- PDF export, share links, eval page route, agent-trace logging.
- Observability: per-agent latency + token usage logged per plan.

### Deliverables
1. Vercel project wired with Postgres + pgvector; CI on PRs.
2. Tables: `plans`, `plan_sections`, `references`, `reviews`, `correction_embeddings`, `agent_traces`, `hypothesis_cache`.
3. `POST /api/feedback` — accepts `{plan_id, section, before, after, rationale}`, embeds and indexes.
4. `GET /api/corrections?experiment_type&section` — top-N few-shots for Person A's agents.
5. `GET /api/plan/:id/diff?against=:otherId` — structural diff between two plan versions.
6. `POST /api/plan/:id/export` — server-rendered PDF.
7. `/api/eval` route powering the eval page (runs Person A's harness on demand).
8. Pre-seeded demo corrections script (`scripts/seed-corrections.ts`) for the live demo.

### Definition of done
- Submitting a correction takes < 2s round-trip.
- After one correction, regenerating a *similar* hypothesis injects it as a few-shot and the diff view shows the change.
- One-command `pnpm seed && pnpm dev` reproduces the demo state.

---

## Interfaces between people (so nobody blocks)

```
Person B  ──/api/qc──►  UI                          (independent)
Person B  ──tavily, classify──►  Person A           (function imports)
Person A  ──/api/plan, /api/regenerate──►  UI       (streamed JSON)
Person A  ──reads corrections──►  Person C          (HTTP GET)
UI ──/api/feedback──►  Person C                     (independent of A)
Person C  ──/api/plan/:id/diff, export──►  UI       (independent of A,B)
```

Person A can mock corrections (`[]`) until Person C ships the endpoint.
Person C can seed dummy plans until Person A's pipeline lands.
Person B is unblocked from minute zero.

---

## Suggested timeline (36–48h hackathon)

| Hours | Person A (Agents) | Person B (Retrieval) | Person C (Infra/Loop) |
|---|---|---|---|
| 0–2 | Schema + Zod types + LLM client stub | Tavily wrapper + profiles | Vercel + Postgres + pgvector + tables |
| 2–6 | Single-agent end-to-end producing valid Plan | `/api/qc` + classifier + cache | DB repo layer + `/api/feedback` skeleton |
| 6–12 | Split into 5 sub-agents + streaming | Catalog validator + supplier profile tuning | Embeddings pipeline + `/api/corrections` |
| 12–18 | Lead PI consistency pass + repair loop | Per-domain prompt tuning vs 4 samples | Plan versioning + diff endpoint |
| 18–24 | Few-shot injection wired to corrections | Novelty signal accuracy pass | PDF export + share links + agent traces |
| 24–30 | Eval harness green on all 4 samples | CI check: 100% catalog resolvability | Seed corrections script + eval page |
| 30–36 | Demo-path tuning + latency cuts | Cache warm-up for demo hypotheses | Deploy hardening + monitoring |
| 36+ | Joint: rehearse 90-sec demo, fix what breaks, record video |

---

## Demo responsibilities

- **Person A** drives the laptop, types the hypothesis, narrates the agent trace.
- **Person B** stands by to swap in a backup hypothesis if Tavily wobbles.
- **Person C** monitors logs, has the pre-seeded correction loaded, owns the diff reveal click.

---

## Single shared "do not break" list

1. Plan JSON schema is frozen — changes require all 3 to ack.
2. Every section returned to UI must include `citations[]`.
3. No agent talks to Tavily directly — only via Person B's wrapper.
4. No route handler talks to Postgres directly — only via Person C's repo.
5. Demo hypothesis + its correction are seeded in CI; if eval goes red, the build doesn't deploy.
