# Person A — Agent Pipeline

Self-contained TypeScript service that turns a hypothesis into a validated `Plan` JSON.
Owns: 6 sub-agents, orchestrator, `/api/plan`, `/api/regenerate`, eval harness.

## Run

```powershell
cd person-a
npm install
copy .env.example .env
# Offline / no API key: STUB_LLM=1 already on by default in .env.example
npm run eval        # runs all 4 brief sample hypotheses
npm run dev         # starts SSE server on PORT (default 8787)
```

### With a real LLM
Set `STUB_LLM=0` and `OPENAI_API_KEY=sk-...` in `.env`.

## Endpoints

- `POST /api/plan` body `{ "hypothesis": "..." }` → `text/event-stream` of:
  - `event: section` `data: { section, content }` (one per agent as it finishes)
  - `event: done`    `data: <full Plan JSON>`
  - `event: error`   `data: { message }`
- `POST /api/regenerate` body `{ "hypothesis": "...", "experiment_type"?: "..." }`
  Same as `/api/plan` but injects prior corrections (from Person C) as few-shots.
- `GET  /healthz` → `{ ok: true }`

## Boundaries (interfaces with B and C)

- Retrieval (Person B) lives behind `src/retrieval/`. Currently a mock; swap in
  the real Tavily wrapper without touching agents.
- Corrections (Person C) live behind `src/corrections/`. Currently a mock; swap
  in the real pgvector lookup without touching agents.

## Eval

`npm run eval` runs all four brief samples (Diagnostics / Gut Health / Cell Bio / Climate)
and asserts:
- Plan parses against the Zod schema
- Every protocol step has ≥1 citation
- Every reagent has a catalog # and supplier URL
- Timeline phase weeks sum equals `weeks`
- Budget total equals sum(lines) + labor + overhead (±$1)

Exit code is non-zero on any failure — wire to CI.
