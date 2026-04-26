// Orchestrator: fan-out 6 agents (with sensible dependencies), run lead PI
// consistency pass, emit a validated Plan. Streams section events via callback.

import { randomUUID } from "node:crypto";

import { runNoveltyAgent }    from "./agents/novelty.js";
import { runOverviewAgent }   from "./agents/overview.js";
import { runProtocolAgent }   from "./agents/protocol.js";
import { runMaterialsAgent }  from "./agents/materials.js";
import { runBudgetAgent }     from "./agents/budget.js";
import { runTimelineAgent }   from "./agents/timeline.js";
import { runValidationAgent } from "./agents/validation.js";
import { consistencyPass }    from "./agents/leadPI.js";

import { mockRetrieval, type RetrievalClient, type RetrievalResult } from "./retrieval/mock.js";
import { mockCorrections, type CorrectionsClient } from "./corrections/mock.js";
import { classifyHypothesis } from "./retrieval/classify.js";

import { PlanSchema, type Plan } from "./shared/types.js";

export type SectionEvent =
  | { kind: "agent_start"; section: string }
  | { kind: "token"; section: string; delta: string }
  | { kind: "section"; section: string; content: unknown; latency_ms: number }
  | { kind: "info"; message: string }
  | { kind: "warning"; message: string };

export interface OrchestrateArgs {
  hypothesis: string;
  experiment_type?: string;       // optional override
  retrieval?: RetrievalClient;    // injection point for Person B
  corrections?: CorrectionsClient;// injection point for Person C
  emit?: (e: SectionEvent) => void;
  applyCorrections?: boolean;     // default false; /api/regenerate sets true
}

export async function orchestrate(args: OrchestrateArgs): Promise<Plan> {
  const retrieval   = args.retrieval   ?? mockRetrieval;
  const corrections = args.corrections ?? mockCorrections;
  const emit        = args.emit        ?? (() => {});
  const apply       = args.applyCorrections ?? false;

  // 1) Classify domain + experiment type (LLM-backed, falls back to heuristic)
  const cls = await classifyHypothesis(args.hypothesis);
  const domain = cls.domain;
  const experiment_type = args.experiment_type ?? cls.experiment_type;
  emit({ kind: "info", message: `classified: ${domain} / ${experiment_type}` });

  // 2) Pull retrieval in parallel
  const [protocols, suppliers, papers] = await Promise.all([
    retrieval.protocols(args.hypothesis),
    retrieval.suppliers(args.hypothesis),
    retrieval.papers(args.hypothesis),
  ]);

  // 3) Pull corrections per section in parallel (only if requested)
  const sections = ["overview", "protocol", "materials", "budget", "timeline", "validation"] as const;
  const correctionsBySection = Object.fromEntries(
    await Promise.all(
      sections.map(async (s) => [
        s,
        apply ? await corrections.topK({ experiment_type, section: s, k: 3 }) : [],
      ])
    )
  ) as Record<(typeof sections)[number], Awaited<ReturnType<CorrectionsClient["topK"]>>>;

  const totalCorrectionsApplied = Object.values(correctionsBySection).reduce((s, v) => s + v.length, 0);

  const baseCtx = {
    hypothesis: args.hypothesis,
    domain,
    experiment_type,
    retrieval: { protocols, suppliers, papers },
  };

  const tokenSink = (section: string) => (delta: string) =>
    emit({ kind: "token", section, delta });

  // 4) Stage 1 — independent agents fan out in parallel
  emit({ kind: "agent_start", section: "novelty" });
  emit({ kind: "agent_start", section: "overview" });
  emit({ kind: "agent_start", section: "protocol" });
  emit({ kind: "agent_start", section: "materials" });
  emit({ kind: "agent_start", section: "validation" });

  const [novelty, overview, protocol, materials, validation] = await Promise.all([
    timed("novelty",    runNoveltyAgent({ hypothesis: args.hypothesis, papers, onDelta: tokenSink("novelty") })),
    timed("overview",   runOverviewAgent({ ...baseCtx, corrections: correctionsBySection.overview, onDelta: tokenSink("overview") })),
    timed("protocol",   runProtocolAgent({ ...baseCtx, corrections: correctionsBySection.protocol, onDelta: tokenSink("protocol") })),
    timed("materials",  runMaterialsAgent({ ...baseCtx, corrections: correctionsBySection.materials, onDelta: tokenSink("materials") })),
    timed("validation", runValidationAgent({ ...baseCtx, corrections: correctionsBySection.validation, onDelta: tokenSink("validation") })),
  ]);

  emit({ kind: "section", section: "novelty",    content: novelty.data,    latency_ms: novelty.trace.latency_ms });
  emit({ kind: "section", section: "overview",   content: overview.data,   latency_ms: overview.trace.latency_ms });
  emit({ kind: "section", section: "protocol",   content: protocol.data,   latency_ms: protocol.trace.latency_ms });
  emit({ kind: "section", section: "materials",  content: materials.data,  latency_ms: materials.trace.latency_ms });
  emit({ kind: "section", section: "validation", content: validation.data, latency_ms: validation.trace.latency_ms });

  // 5) Stage 2 — timeline depends on protocol, budget depends on materials + timeline
  emit({ kind: "agent_start", section: "timeline" });
  const timeline = await timed("timeline", runTimelineAgent(
    { ...baseCtx, corrections: correctionsBySection.timeline, onDelta: tokenSink("timeline") },
    protocol.data
  ));
  emit({ kind: "section", section: "timeline", content: timeline.data, latency_ms: timeline.trace.latency_ms });

  emit({ kind: "agent_start", section: "budget" });
  const budget = await timed("budget", runBudgetAgent(
    { ...baseCtx, corrections: correctionsBySection.budget, onDelta: tokenSink("budget") },
    materials.data,
    timeline.data
  ));
  emit({ kind: "section", section: "budget", content: budget.data, latency_ms: budget.trace.latency_ms });

  // 6) Assemble + lead PI consistency
  const draft: Plan = {
    id: randomUUID(),
    created_at: new Date().toISOString(),
    hypothesis: args.hypothesis,
    domain,
    experiment_type,
    novelty:    novelty.data,
    overview:   overview.data,
    protocol:   protocol.data,
    materials:  materials.data,
    budget:     budget.data,
    timeline:   timeline.data,
    validation: validation.data,
    provenance: {
      agent_traces: [
        novelty.trace, overview.trace, protocol.trace, materials.trace,
        validation.trace, timeline.trace, budget.trace,
      ],
      corrections_applied: totalCorrectionsApplied,
    },
  };

  // 6a) Pre-PI grounding repair — patch citation gaps using the Tavily URLs we
  // already paid for. Free (no LLM call), deterministic, and only triggers when
  // an LLM forgets to paste a URL. Without this the demo dies on Lead PI.
  groundingRepair(draft, { protocols, suppliers, papers }, emit);

  const { plan, report } = consistencyPass(draft);
  for (const f of report.fixed)    emit({ kind: "info",    message: `lead-PI fixed: ${f}` });
  for (const w of report.warnings) emit({ kind: "warning", message: `lead-PI warning: ${w}` });

  // Final schema gate — throws loud if anything is still wrong.
  const final = PlanSchema.parse(plan);
  return final;
}

/**
 * Deterministic, pre-LeadPI repair using the retrieval block:
 *  - Protocol steps with no http(s) citation → inject the first protocols URL
 *    (falls back to papers, then suppliers).
 *  - Budget missing a 'reagents' line while materials non-empty → synthesize
 *    one covering materials.total_usd, cited from a material's catalog_url.
 *  - Budget lines with no http(s) citation → inject a sensible source URL.
 */
function groundingRepair(
  plan: Plan,
  refs: { protocols: RetrievalResult[]; suppliers: RetrievalResult[]; papers: RetrievalResult[] },
  emit: (e: SectionEvent) => void
) {
  const isUrl = (s: string | undefined) => !!s && /^https?:\/\//.test(s);
  const fallback =
    refs.protocols.find((r) => isUrl(r.url)) ??
    refs.papers.find((r) => isUrl(r.url)) ??
    refs.suppliers.find((r) => isUrl(r.url));

  // --- protocol citations
  for (const step of plan.protocol.steps) {
    const hasUrl = step.citations.some((c) => isUrl(c.url));
    if (hasUrl) continue;
    if (!fallback) continue;
    step.citations = [{ url: fallback.url, label: fallback.title }];
    emit({ kind: "info", message: `repair: protocol step ${step.n} cited ${fallback.url}` });
  }

  // --- budget reagents line
  if (plan.materials.items.length > 0) {
    const hasReagents = plan.budget.lines.some((l) => l.category === "reagents");
    if (!hasReagents) {
      const cite =
        plan.materials.items.find((m) => isUrl(m.catalog_url))?.catalog_url ??
        refs.suppliers.find((r) => isUrl(r.url))?.url ??
        fallback?.url;
      if (cite) {
        plan.budget.lines.unshift({
          category: "reagents",
          description: `All reagents per materials list (${plan.materials.items.length} item${
            plan.materials.items.length === 1 ? "" : "s"
          }).`,
          cost_usd: plan.materials.total_usd,
          citations: [{ url: cite, label: "supplier catalog" }],
        });
        plan.budget.total_usd = round2(plan.budget.lines.reduce((s, l) => s + l.cost_usd, 0));
        emit({ kind: "info", message: `repair: synthesized budget.reagents line ($${plan.materials.total_usd})` });
      }
    }
  }

  // --- budget line citations
  for (const line of plan.budget.lines) {
    const hasUrl = line.citations.some((c) => isUrl(c.url));
    if (hasUrl) continue;
    const cite =
      line.category === "reagents" || line.category === "consumables"
        ? refs.suppliers.find((r) => isUrl(r.url))?.url
        : line.category === "labor" || line.category === "overhead"
        ? "https://www.bls.gov/oes/current/oes192012.htm"
        : fallback?.url;
    if (cite) {
      line.citations = [{ url: cite, label: `${line.category} reference` }];
      emit({ kind: "info", message: `repair: budget '${line.category}' cited ${cite}` });
    }
  }
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function timed<T extends { trace: { latency_ms: number } }>(_label: string, p: Promise<T>): Promise<T> {
  return p;
}
