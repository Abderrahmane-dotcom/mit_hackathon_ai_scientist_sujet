## Repo recap — what we're porting

The repo `Abderrahmane-dotcom/mit_hackathon_ai_scientist_sujet` ships a self-contained TypeScript Node service in `person-a/`:

- **6 agents** (`novelty`, `overview`, `protocol`, `materials`, `budget`, `timeline`, `validation`) + a deterministic **Lead PI consistency pass** that auto-repairs totals/timeline math.
- **Orchestrator** that fans out independent agents in parallel, then runs `timeline` (depends on protocol) and `budget` (depends on materials + timeline), assembles a `Plan`, runs `groundingRepair` to patch missing citations, then validates the whole thing with a Zod `PlanSchema`.
- **LLM client** with 4 providers: `groq` (default, OpenAI-compatible), `openai`, `gemini`, `stub`. Each call uses **structured JSON output + Zod validation + one repair retry** if validation fails.
- **Retrieval**: real `tavily` client (with sha256 in-memory cache, 24h TTL, 12s timeout, soft-fails to `[]`), or `mock`. `pickRetrieval()` auto-selects based on `TAVILY_API_KEY`.
- **Corrections**: pgvector lookup is a mock today — Person C's territory. We'll keep the mock since it's not wired up.
- **HTTP API** (`src/server.ts`) — node:http server exposing:
  - `POST /api/plan` (SSE stream)
  - `POST /api/regenerate` (SSE, applies corrections)
  - `POST /api/qc` (novelty only, fast)
  - `POST /api/classify`
  - `POST /api/validate-catalog`
  - `POST /api/export/markdown`
  - `POST /api/plan.md` (full pipeline, returns markdown)
  - `GET /healthz`

It's pure ESM TypeScript with **only 3 runtime deps**: `openai`, `@google/genai`, `zod`. All Web-standard `fetch` for Tavily. No native modules. **This will run cleanly in the Cloudflare Worker SSR runtime** (with `nodejs_compat` for `node:crypto`).

---

## Porting strategy

### What stays the same (copy-paste, .js → no extension)
The agents, orchestrator, types, llm client, retrieval, corrections, lead PI pass, markdown exporter, samples — these are pure TS with `node:crypto` + `fetch`. I'll copy them under `src/server/agents/` etc. and strip the `.js` extensions from imports (TanStack/Vite uses standard TS resolution).

### What gets replaced
- **`src/server.ts`** (the node:http server) → replaced by **TanStack server functions** (`createServerFn`) for the JSON endpoints, and a **server route** (`src/routes/api/plan.ts`) for the SSE streaming endpoint (server functions don't stream natively).
- **`src/bootstrap.ts`** (.env loader) → deleted. Lovable Cloud secrets are already injected as `process.env.*` at runtime.

### What gets dropped from the repo (not needed)
- `eval.ts`, `scripts/`, `reports/`, `samples.ts` (dev-only)
- `package-lock.json`, the repo's own `package.json`/`tsconfig.json`

### Secrets needed (added via Lovable Cloud `add_secret`)
- `GROQ_API_KEY` — primary LLM (free tier, fastest)
- `TAVILY_API_KEY` — real paper retrieval (optional, falls back to mock)
- *(optional)* `GEMINI_API_KEY` and/or `OPENAI_API_KEY` if you want to switch providers
- `LLM_PROVIDER` defaults to `groq`. If unset and no `GROQ_API_KEY`, we'll set `STUB_LLM=1` so the demo still works.

I'll request these *after* you approve this plan.

---

## File-by-file plan

### 1. Add deps
```
bun add openai @google/genai zod
```

### 2. Port backend (under `src/server/`)
Create:
- `src/server/shared/types.ts` — copy verbatim
- `src/server/llm/client.ts`, `llm/ratelimit.ts`, `llm/stub.ts` — copy verbatim, strip `.js` extensions
- `src/server/agents/{base,novelty,overview,protocol,materials,budget,timeline,validation,leadPI}.ts` — copy verbatim
- `src/server/retrieval/{index,mock,tavily,profiles,classify,validateCatalog}.ts` — copy verbatim
- `src/server/corrections/mock.ts` — copy verbatim
- `src/server/orchestrator.ts` — copy verbatim
- `src/server/export/markdown.ts` — copy verbatim

### 3. TanStack server-side wrappers
Create thin `createServerFn` wrappers at `src/server/functions/`:
- `plan.ts` → `generatePlan({ hypothesis })` runs `orchestrate()` and returns full `Plan` JSON (no streaming — single response). For the hackathon demo, this is fast enough (Groq on the 70B model is ~5–15s for the full pipeline).
- `qc.ts` → `runQC({ hypothesis })` — fast novelty-only check, used right after the user submits their hypothesis (before "Generate Full Plan").
- `exportMarkdown.ts` → `exportPlanMarkdown({ plan })` returns markdown string.

### 4. (Optional) SSE streaming route
If you want the original token-streaming UX, add `src/routes/api/plan.ts` as a TanStack server route that streams `text/event-stream` exactly like the original `/api/plan` endpoint. **I'll add this only if you want it** — for the current desk UI, a single response works fine (the modal already shows a "Synthesizing…" spinner). Recommendation: **skip SSE for v1**, ship the simpler RPC version, add streaming later.

### 5. Frontend wiring (`src/routes/index.tsx`)
Replace the mock data flow with real server function calls:

- **Stage 1 → Stage 2** (user clicks "Analyze"):
  - Call `runQC({ hypothesis })` via `useServerFn` + `useMutation`.
  - On success, store the novelty result + papers, drop the Paper, auto-open the Literature QC modal showing **real** papers and signal.
  - On error, show a toast and stay in input stage.

- **Inside Literature QC → "Generate Full Plan"**:
  - Call `generatePlan({ hypothesis })` (which re-runs novelty internally + the other 5 agents — minor duplicated work, acceptable for v1; later we can pass the cached novelty in).
  - On success, store the `Plan` in state, close the modal, transition to `full-desk`.
  - On error, show error inside the modal footer with a Retry button.

- **All 5 modal bodies** rewritten to read from real `Plan` instead of `MOCK_PLAN`:
  - `LiteratureBody` → `plan.novelty.signal` + `plan.novelty.refs` (no similarity score in real schema — I'll show `source` badge instead, or compute a simple "X of N retrieved" indicator).
  - `OverviewBody` → `plan.overview.{primary_goal, validation_approach, success_criteria}`.
  - `ProtocolBody` → `plan.protocol.steps[]` (each has `n, title, description, duration_hours, citations[]`).
  - `TimelineBody` → `plan.timeline.{weeks, phases, critical_path, slack_weeks}` — I'll generalize the Gantt to use `plan.timeline.weeks` instead of hardcoded 10, and color-cycle phases.
  - `BudgetBody` → table now shows `plan.materials.items[]` (reagents) and `plan.budget.lines[]` (categories: reagents/consumables/equipment/labor/overhead/other), with `plan.budget.total_usd` as the grand total. Inline editing is kept but local-only (no persistence yet).

### 6. Loading & error UX
- During `generatePlan`, the modal footer shows "Synthesizing…" and the desk objects are pre-mounted but ghosted until success.
- If the schema validation throws (rare, but possible if Groq misbehaves twice), show the error message in a toast with a "Retry" button.

### 7. Keep `mock-data.ts` as a dev fallback
If `STUB_LLM=1` is set or no API keys are available, the existing `stub.ts` already returns deterministic fake plans — the UI just works. So no special branching needed in the frontend.

---

## Compatibility notes / risks

- **Cloudflare Worker SSR**: `node:crypto` (`randomUUID`, `createHash`) and `fetch` are supported with `nodejs_compat`. ✅
- **OpenAI SDK + Groq baseURL**: works in Workers (uses `fetch` under the hood). ✅
- **`@google/genai`**: pure JS, fetch-based. Should work, but we're defaulting to Groq anyway.
- **No `child_process`, no `fs.watch`, no native modules** in any of the ported files. ✅
- **Total LLM latency**: Groq 70B is ~1–3s per agent; with 5 parallel + 2 sequential, expect **~6–12s** end-to-end for the full plan. Acceptable for a hackathon demo.
- **Tavily credit budget**: 1000 credits, ~3 calls per plan, 24h cache → ~333 unique hypotheses. Plenty.

---

## Deliverables after this plan is approved

1. Ask for the API key(s) via `add_secret` (Groq + Tavily).
2. Install npm deps.
3. Port all backend files into `src/server/`.
4. Create 3 server functions: `runQC`, `generatePlan`, `exportPlanMarkdown`.
5. Rewire `src/routes/index.tsx`: real QC after submit, real plan after "Generate Full Plan", all 5 modal bodies driven by the real `Plan` JSON.
6. Add basic error toasts + retry.
7. Verify `/healthz`-equivalent (a tiny server function that returns `{ ok: true, provider }`).

After approval, please confirm:
- **Do you want SSE token streaming** (more code, fancier UX) **or just the simpler single-response RPC** (recommended for v1)?
- **Which LLM provider** — Groq (default, free, fast), or do you already have an OpenAI/Gemini key you'd rather use?
- **Tavily key** — do you have one, or should we ship with the mock retrieval (still produces a real plan, just with hard-coded "papers")?