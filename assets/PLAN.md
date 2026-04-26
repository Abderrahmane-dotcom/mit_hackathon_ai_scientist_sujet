# Hypothesis Hub — Winning Plan
**Hackathon:** MIT HacksNation 5 · Challenge 04 *The AI Scientist* (powered by Fulcrum Science)
**Stack:** Lovable (UI) · Tavily (grounded retrieval) · Vercel (deploy + edge functions)
**Working name in UI:** *Hypothesis Hub — The AI Scientist*

---

## 1. What we already have (from the Lovable snaps)

A beautifully art-directed "desk" metaphor that reframes a dry experiment plan as a tactile workspace. Five modal "objects" already render:

| Object | Modal | Content visible in screens |
|---|---|---|
| 📄 Paper | `01 · The Paper` | Hypothesis text (input stage) |
| 🖥️ Monitor | `02 · The Screen` — *Overview* | Primary goal, validation approach, success criteria (perovskite tandem PCE example) |
| 📋 Clipboard | `03 · The Clipboard` | Protocol steps (assumed) |
| 🕒 Clock | `04 · The Clock` — *Timeline · 10 weeks* | Color-coded Gantt, critical path P1→P6, slack 0w |
| 🔒 Vault | `05 · The Vault` — *Materials & Budget* | Reagent table with linked catalog #s (TCI, Sigma, Alfa Aesar, Greatcell) + USD costs |
| 🐷 Piggy | (visible card) | Likely budget summary / cost-vs-CRO |

State flow `input → paper-only → full-desk` is wired and the hero "The desk is set." reveal is in place. **The visual layer is ahead of most teams. Now we need to make the *substance* judge-proof and add the learning loop.**

---

## 2. Judging criteria → concrete moves

| Criterion | Where we win |
|---|---|
| **Technical depth** | Multi-agent grounded generation + pgvector feedback store + visible "agent trace" |
| **Communication** | Desk metaphor + 90-sec scripted demo + clean README + 1-slide architecture |
| **Innovation** | Nail the *Scientist Review* stretch goal — generate → correct → regenerate with diff |

Most teams will ship "input → plan." Few will ship a **learning loop you can demo live.** That's our wedge.

---

## 3. Architecture (Lovable + Tavily + Vercel)

```
Lovable (Next.js)  ──►  Vercel Route Handlers ──►  Agent Orchestrator
   desk UI                /api/qc                     ├─ Protocol agent   (Tavily: protocols.io, bio-protocol, nprot, jove)
   5 modal objects        /api/plan                   ├─ Materials agent  (Tavily: sigma, thermo, addgene, atcc, tci)
   review overlays        /api/feedback               ├─ Budget agent     (consumes materials)
                          /api/regenerate             ├─ Timeline agent   (consumes protocol → Gantt JSON)
                                                      ├─ Validation agent (MIQE-style QC + controls)
                                                      └─ Lead "PI" agent  (consistency + final JSON)

Storage: Vercel Postgres + pgvector
   plans, sections, references, reviews, correction_embeddings
```

### 3.1 Plan JSON schema (freeze in hour 1)

```ts
type Plan = {
  id: string;
  hypothesis: string;
  experiment_type: string;   // e.g. "perovskite-tandem-fab", "cell-cryopreservation"
  domain: string;            // "materials", "cell-bio", "diagnostics", "climate"
  novelty: { signal: "not_found"|"similar_work_exists"|"exact_match"; refs: Ref[] };
  overview:   { goal: string; validation: string; success_criteria: string[] };
  protocol:   { steps: Step[] };                       // each step has citations[]
  materials:  { items: Reagent[]; total_usd: number }; // catalog_url required
  timeline:   { weeks: number; phases: Phase[]; critical_path: string[]; slack: number };
  validation: { metrics: Metric[]; controls: string[]; stats: string };
  budget:     { lines: BudgetLine[]; labor: number; overhead: number; total_usd: number };
  provenance: { agent_traces: AgentTrace[] };
};
```

Every section carries `citations[]` (Tavily URLs). UI renders a tiny "source" pill per section — judges love provenance.

### 3.2 The Literature QC step (gate the desk reveal)

- Tavily multi-source query (arXiv, Semantic Scholar, protocols.io).
- LLM judge bins similarity into `not_found | similar_work_exists | exact_match` + 1–3 refs.
- UI: show novelty card *between* `paper-only` and `full-desk`. The desk only "sets" after QC clears. Great dramatic beat for the demo.

### 3.3 The learning loop (stretch goal — the killer demo)

1. Each modal section gets inline **rate / correct / annotate** controls.
2. On submit → `{experiment_type, domain, section, before, after, rationale}` written to Postgres + embedded into pgvector.
3. Next generation: lead PI agent does a vector search on `experiment_type + section`, injects top-N corrections as **few-shot exemplars** into the relevant sub-agent prompt:
   > "Senior reviewers previously corrected: *trehalose 5% → 10% w/v* because *…*. Apply when applicable."
4. Demo trick: pre-seed one strong correction. On stage, type a second one live. Regenerate a *similar* hypothesis. **Show the diff.** That's the moment.

---

## 4. Backlog — ordered for max judge ROI

### P0 — must ship
- [ ] Freeze plan JSON schema + TypeScript types shared FE/BE
- [ ] `/api/qc` Tavily endpoint + novelty card UI gate
- [ ] Single-agent MVP that produces a valid Plan for all 4 sample inputs
- [ ] Wire the 5 desk modals to real Plan JSON (currently looks like static demo data)
- [ ] Citation pill on every section (hover = source URL)
- [ ] Catalog # column links resolve to real supplier pages (Tavily-validated)

### P1 — depth
- [ ] Split into 5 sub-agents, run in parallel, stream results into modals as they finish
- [ ] Lead PI consistency pass (timeline covers every protocol step; budget covers every reagent)
- [ ] Collapsible "agent trace" drawer (visualizes parallel agents — looks technical without slides)
- [ ] Validation modal (currently not visible) — controls, n, statistical power, MIQE notes

### P2 — the moat (stretch goal)
- [ ] Inline review UI on each modal: rate 👍/👎, correct text, leave rationale
- [ ] `corrections` table + pgvector index keyed on `(experiment_type, section)`
- [ ] Few-shot injection in prompt builder; show "applied N prior corrections" badge in UI
- [ ] **Diff view** between plan v1 and plan v2 after a correction — side-by-side highlight

### P3 — wow factor
- [ ] Export plan as PDF (the "Add exportable plan PDF" suggestion already in Lovable)
- [ ] Cost-vs-CRO callout on the Piggy modal: "CRO baseline ~$X / 6 weeks → Hypothesis Hub: $Y / 90 sec"
- [ ] Eval page `/eval` running all 4 sample inputs with schema + citation-resolvability checks
- [ ] Share link → public read-only plan URL (great for judges to revisit)

---

## 5. Demo script (90 seconds)

1. **0:00** — "Going from a hypothesis to a runnable experiment takes weeks. Watch this take 90 seconds."
2. **0:08** — Type the **trehalose / HeLa cryopreservation** sample into the Paper.
3. **0:15** — Novelty card flips up: *similar work exists* + 2 refs. *"Grounded, not plagiarising."*
4. **0:22** — "The desk is set." Five objects fan out.
5. **0:30** — Click 📋 Clipboard → protocol steps with protocols.io citations.
6. **0:45** — Click 🔒 Vault → reagent table, click `Sigma-203033` → opens real Sigma page in new tab.
7. **0:55** — Click 🕒 Clock → 10-week Gantt with critical path.
8. **1:05** — Open review on a protocol step: change "5% trehalose" → "10%", note "membrane stabilization plateau". Save.
9. **1:15** — New hypothesis (similar: yeast cryopreservation). Generate. Vault now shows **10% trehalose** with badge: *"applied 1 prior correction."*
10. **1:25** — Cost-vs-CRO slide: *weeks → minutes, ~$8k consult → $0.30 inference.*
11. **1:30** — "A tool that compounds. Every review makes the next plan better."

---

## 6. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Hallucinated catalog #s | Materials agent must cite a Tavily-resolved supplier URL; reject lines without one |
| Slow generation kills the demo | Stream agents into modals as they finish; pre-warm with the demo hypothesis |
| Stretch goal looks staged | Pre-seed one correction; let a judge type the second live |
| Tavily rate limits | Cache by `sha256(hypothesis)` in Postgres |
| Scope creep | Schema frozen hour 1; everything serializes through it |

---

## 7. UI notes specifically for the current Lovable build

- **Keep the desk metaphor** — it's the brand. Judges will remember it.
- **Add a 6th object: 🧪 Beaker = Validation.** Currently missing in the visible modals despite being in the brief.
- **Add a 7th micro-object: 📌 Pin = Novelty/QC.** Sits on the Paper before the desk reveal.
- **Citation pill style**: small monospace chip after each claim, e.g. `[protocols.io/abc]`. Hover = preview.
- **Agent trace drawer**: bottom edge of the desk, slides up. Five lanes streaming logs while modals fill.
- **Review mode toggle** (top-right): turns each modal into an editable surface with rate / correct controls.
- **Plan version selector**: `v1 · v2 · v3` chips with a "diff" button — required for the stretch-goal demo.

---

## 8. Day-of execution order (suggested)

1. Schema + types (1h)
2. `/api/qc` + novelty card (2h)
3. Single-agent plan generator → fill all 5 modals end-to-end (4h)
4. Split sub-agents + streaming + citation pills (4h)
5. Review UI + corrections store + pgvector (5h)
6. Few-shot injection + diff view (3h)
7. PDF export + cost-vs-CRO + eval page (3h)
8. Seed corrections, run all 4 samples, fix what breaks (2h)
9. Record 90-sec video, write README, prep slide (3h)
10. Buffer (3h) — do not skip

---

## 9. One-liner for the submission form

> **Hypothesis Hub** turns a scientific question into a Monday-ready experiment plan — protocol, real catalog numbers, costed Gantt, and a novelty check — on a tactile "desk" UI that *learns from every PI correction.*
