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

import { mockRetrieval, type RetrievalClient } from "./retrieval/mock.js";
import { mockCorrections, type CorrectionsClient } from "./corrections/mock.js";

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

  // 1) Classify domain + experiment type
  const cls = await retrieval.classify(args.hypothesis);
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

  const { plan, report } = consistencyPass(draft);
  for (const f of report.fixed)    emit({ kind: "info",    message: `lead-PI fixed: ${f}` });
  for (const w of report.warnings) emit({ kind: "warning", message: `lead-PI warning: ${w}` });

  // Final schema gate — throws loud if anything is still wrong.
  const final = PlanSchema.parse(plan);
  return final;
}

async function timed<T extends { trace: { latency_ms: number } }>(_label: string, p: Promise<T>): Promise<T> {
  return p;
}
