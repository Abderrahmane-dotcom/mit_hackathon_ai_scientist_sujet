import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Beaker,
  ArrowRight,
  Loader2,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Pencil,
} from "lucide-react";
import { DeskScene, type DeskItemId } from "@/components/desk-scene";
import { DeskModal } from "@/components/desk-modal";
import { runQC } from "@/server/functions/qc";
import { streamPlan } from "@/lib/plan-stream";
import type { Plan, Reference } from "@/server/shared/types";
import type { SectionEvent } from "@/server/orchestrator";

export const Route = createFileRoute("/")({
  component: Index,
});

type Stage = "input" | "paper-only" | "full-desk";

const SAMPLE = "Can we improve solar cell efficiency by testing alternative materials?";

const NOVELTY_CONFIG = {
  exact_match: {
    label: "Exact Match Found",
    Icon: AlertTriangle,
    accent: "text-signal-rose",
    bg: "bg-signal-rose/10",
    border: "border-signal-rose/30",
    dot: "bg-signal-rose",
  },
  similar_work_exists: {
    label: "Similar Work Exists",
    Icon: AlertTriangle,
    accent: "text-signal-amber",
    bg: "bg-signal-amber/10",
    border: "border-signal-amber/30",
    dot: "bg-signal-amber",
  },
  not_found: {
    label: "Not Found — Novel Direction",
    Icon: CheckCircle2,
    accent: "text-signal-mint",
    bg: "bg-signal-mint/10",
    border: "border-signal-mint/30",
    dot: "bg-signal-mint",
  },
} as const;

type NoveltyResult = {
  signal: keyof typeof NOVELTY_CONFIG;
  refs: Reference[];
};

function Index() {
  const [stage, setStage] = useState<Stage>("input");
  const [hypothesis, setHypothesis] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [openModal, setOpenModal] = useState<DeskItemId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [novelty, setNovelty] = useState<NoveltyResult | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const runQCFn = useServerFn(runQC);

  const visibleItems: DeskItemId[] =
    stage === "input"
      ? []
      : stage === "paper-only"
        ? ["paper"]
        : ["paper", "monitor", "clipboard", "clock", "vault"];

  const handleAnalyze = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const h = hypothesis.trim();
      if (!h) return;
      setAnalyzing(true);
      setError(null);
      try {
        const res = await runQCFn({ data: { hypothesis: h } });
        if (!res.ok) throw new Error(res.error);
        setNovelty(res.novelty as NoveltyResult);
        setStage("paper-only");
        setTimeout(() => setOpenModal("paper"), 700);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to analyze hypothesis");
      } finally {
        setAnalyzing(false);
      }
    },
    [hypothesis, runQCFn],
  );

  const handleGenerate = useCallback(async () => {
    const h = hypothesis.trim();
    if (!h) return;
    setGenerating(true);
    setError(null);
    setProgress("Classifying hypothesis…");
    // Track which agents are currently in flight so the status reflects
    // real concurrency instead of the last agent_start event.
    const running = new Set<string>();
    const done: string[] = [];
    const renderProgress = () => {
      if (running.size > 0) {
        const names = Array.from(running).join(", ");
        setProgress(
          running.size === 1
            ? `Running ${names} agent…`
            : `Running ${running.size} agents in parallel: ${names}…`,
        );
      } else if (done.length > 0) {
        setProgress(`✓ ${done[done.length - 1]} complete`);
      }
    };
    try {
      const result = await streamPlan(h, {
        onEvent: (ev: SectionEvent) => {
          if (ev.kind === "agent_start") {
            running.add(ev.section);
            renderProgress();
          } else if (ev.kind === "section") {
            running.delete(ev.section);
            done.push(`${ev.section} (${(ev.latency_ms / 1000).toFixed(1)}s)`);
            renderProgress();
          } else if (ev.kind === "info") {
            // Only show info messages when no agents are actively running,
            // otherwise the parallel-status label is more informative.
            if (running.size === 0) setProgress(ev.message);
          }
        },
      });
      setPlan(result);
      // Refresh novelty from the (more authoritative) full plan
      setNovelty(result.novelty as NoveltyResult);
      setOpenModal(null);
      setStage("full-desk");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan generation failed");
    } finally {
      setGenerating(false);
      setProgress(null);
    }
  }, [hypothesis]);

  const handleReset = () => {
    setStage("input");
    setHypothesis("");
    setOpenModal(null);
    setNovelty(null);
    setPlan(null);
    setError(null);
    setProgress(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  useEffect(() => {
    if (stage === "input") textareaRef.current?.focus();
  }, [stage]);

  return (
    <div className="min-h-screen">
      {/* ============ HEADER ============ */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="size-8 rounded-lg bg-gradient-to-br from-primary/30 to-signal-violet/30 border border-primary/30 grid place-items-center">
              <Beaker className="size-4 text-primary" strokeWidth={2} />
            </div>
            <div className="leading-tight">
              <p className="font-display italic text-base">The AI Scientist</p>
              <p className="text-[10px] mono uppercase tracking-[0.18em] text-muted-foreground">
                Hypothesis → Plan
              </p>
            </div>
          </div>

          {stage !== "input" && (
            <>
              <div className="flex-1 max-w-2xl mx-auto hidden md:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface border border-border">
                <span className="text-[10px] uppercase tracking-wider mono text-muted-foreground shrink-0">
                  H₀
                </span>
                <p className="text-sm text-foreground/90 truncate flex-1">{hypothesis}</p>
              </div>
              <button
                onClick={handleReset}
                className="ml-auto md:ml-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border-strong rounded-lg px-3 py-2 transition-colors shrink-0"
              >
                <RotateCcw className="size-3.5" /> New
              </button>
            </>
          )}

          {stage === "input" && (
            <div className="ml-auto hidden sm:flex items-center gap-1.5 text-[11px] mono text-muted-foreground">
              <span className="size-1.5 rounded-full bg-signal-mint animate-pulse" />
              v0.1 · hackathon build
            </div>
          )}
        </div>
      </header>

      {/* ============ MAIN: THE DESK ============ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 sm:pt-12 pb-16">
        <div className="text-center mb-8 max-w-3xl mx-auto">
          <p className="text-[11px] mono uppercase tracking-[0.22em] text-signal-cyan mb-4">
            {stage === "input"
              ? "An operational research planner"
              : stage === "paper-only"
                ? "Step 1 of 2 · Review the literature"
                : "Your plan is laid out — click any object"}
          </p>
          <h1 className="font-display text-4xl sm:text-6xl leading-[1.05] tracking-tight text-balance">
            {stage === "input" ? (
              <>
                From a sentence
                <br />
                to a <span className="italic text-primary">lab-ready plan.</span>
              </>
            ) : stage === "paper-only" ? (
              <>
                The <span className="italic text-primary">Paper</span> has landed.
              </>
            ) : (
              <>
                The <span className="italic text-primary">desk</span> is set.
              </>
            )}
          </h1>
        </div>

        {error && stage === "input" && (
          <div className="max-w-2xl mx-auto mb-6 px-4 py-3 rounded-xl border border-signal-rose/40 bg-signal-rose/10 text-sm text-signal-rose flex items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <DeskScene
          visibleItems={visibleItems}
          onItemClick={(id) => setOpenModal(id)}
          centerSlot={
            stage === "input" ? (
              <NotebookInput
                ref={textareaRef}
                hypothesis={hypothesis}
                setHypothesis={setHypothesis}
                onSubmit={handleAnalyze}
                analyzing={analyzing}
              />
            ) : null
          }
        />
      </main>

      {/* ============ MODALS ============ */}
      <DeskModal
        open={openModal === "paper"}
        onClose={() => setOpenModal(null)}
        kicker="01 · The Paper"
        title="Literature QC"
        toneClass="text-signal-amber"
        size="lg"
        footer={
          <>
            {error && generating === false && stage === "paper-only" && (
              <span className="text-xs text-signal-rose mr-auto truncate max-w-md">{error}</span>
            )}
            {progress && generating && (
              <span className="text-xs text-muted-foreground mr-auto truncate max-w-md mono">
                {progress}
              </span>
            )}
            <button
              onClick={() => setOpenModal(null)}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating || stage === "full-desk"}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Synthesizing…
                </>
              ) : stage === "full-desk" ? (
                <>
                  <CheckCircle2 className="size-4" /> Plan generated
                </>
              ) : error ? (
                <>
                  <Sparkles className="size-4" /> Retry
                </>
              ) : (
                <>
                  <Sparkles className="size-4" /> Generate Full Plan
                </>
              )}
            </button>
          </>
        }
      >
        <LiteratureBody novelty={novelty} />
      </DeskModal>

      <DeskModal
        open={openModal === "monitor"}
        onClose={() => setOpenModal(null)}
        kicker="02 · The Screen"
        title="Overview"
        toneClass="text-signal-cyan"
        size="lg"
      >
        {plan ? <OverviewBody plan={plan} /> : <EmptyBody />}
      </DeskModal>

      <DeskModal
        open={openModal === "clipboard"}
        onClose={() => setOpenModal(null)}
        kicker="03 · The Checklist"
        title="Protocol"
        toneClass="text-signal-violet"
        size="lg"
      >
        {plan ? <ProtocolBody plan={plan} /> : <EmptyBody />}
      </DeskModal>

      <DeskModal
        open={openModal === "clock"}
        onClose={() => setOpenModal(null)}
        kicker="04 · The Clock"
        title={plan ? `Timeline · ${plan.timeline.weeks} weeks` : "Timeline"}
        toneClass="text-signal-rose"
        size="xl"
      >
        {plan ? <TimelineBody plan={plan} /> : <EmptyBody />}
      </DeskModal>

      <DeskModal
        open={openModal === "vault"}
        onClose={() => setOpenModal(null)}
        kicker="05 · The Vault"
        title="Materials & Budget"
        toneClass="text-signal-mint"
        size="xl"
      >
        {plan ? <BudgetBody plan={plan} /> : <EmptyBody />}
      </DeskModal>
    </div>
  );
}

/* ============================================================
 * NOTEBOOK INPUT (center of empty desk)
 * ============================================================ */
const NotebookInput = ({
  ref,
  hypothesis,
  setHypothesis,
  onSubmit,
  analyzing,
}: {
  ref: React.RefObject<HTMLTextAreaElement | null>;
  hypothesis: string;
  setHypothesis: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  analyzing: boolean;
}) => {
  return (
    <form
      onSubmit={onSubmit}
      className="relative bg-card rounded-2xl border border-border-strong p-5 sm:p-6"
      style={{
        boxShadow:
          "0 1px 0 0 oklch(1 0 0 / 0.7) inset, 0 8px 16px -4px oklch(0.2 0.02 60 / 0.18), 0 24px 48px -12px oklch(0.2 0.02 60 / 0.32)",
        backgroundImage:
          "repeating-linear-gradient(transparent, transparent 27px, oklch(0.5 0.1 220 / 0.08) 28px)",
      }}
    >
      <div className="absolute left-10 top-4 bottom-4 w-px bg-signal-rose/30" />
      <div className="absolute left-2 top-4 bottom-4 flex flex-col justify-around">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="size-1.5 rounded-full bg-foreground/20" />
        ))}
      </div>

      <div className="pl-12">
        <label
          htmlFor="hyp"
          className="text-[10px] mono uppercase tracking-[0.2em] text-muted-foreground"
        >
          Hypothesis
        </label>
        <textarea
          id="hyp"
          ref={ref}
          value={hypothesis}
          onChange={(e) => setHypothesis(e.target.value)}
          rows={3}
          placeholder={`e.g., ${SAMPLE}`}
          className="mt-2 w-full bg-transparent text-base sm:text-lg leading-[28px] text-foreground placeholder:text-muted-foreground/60 outline-none resize-none font-display italic"
        />
        <div className="mt-3 flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setHypothesis(SAMPLE)}
            className="text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            ↳ Use example
          </button>
          <button
            type="submit"
            disabled={!hypothesis.trim() || analyzing}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {analyzing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Screening…
              </>
            ) : (
              <>
                Analyze <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

/* ============================================================
 * MODAL CONTENT BODIES
 * ============================================================ */

function EmptyBody() {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">
      <Loader2 className="size-5 animate-spin mx-auto mb-3 opacity-60" />
      Plan not yet synthesized. Open The Paper and click Generate Full Plan.
    </div>
  );
}

function LiteratureBody({ novelty }: { novelty: NoveltyResult | null }) {
  if (!novelty) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        <Loader2 className="size-5 animate-spin mx-auto mb-3 opacity-60" />
        Screening literature…
      </div>
    );
  }
  const cfg = NOVELTY_CONFIG[novelty.signal];
  const refs = novelty.refs ?? [];
  return (
    <div>
      <div
        className={`flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-medium w-fit ${cfg.bg} ${cfg.border} ${cfg.accent}`}
      >
        <span className={`size-1.5 rounded-full ${cfg.dot} animate-pulse`} />
        <cfg.Icon className="size-3.5" strokeWidth={2} />
        {cfg.label}
      </div>

      <p className="mt-5 text-sm text-muted-foreground max-w-2xl text-pretty">
        {refs.length === 0
          ? "No clear prior work surfaced for this hypothesis. Proceed with care — search may have missed adjacent literature."
          : `We screened the literature for related work. ${refs.length} reference${refs.length === 1 ? "" : "s"} surfaced — review before committing bench time.`}
      </p>

      <ul className="mt-5 divide-y divide-border">
        {refs.map((p, i) => (
          <li key={`${p.url}-${i}`} className="py-4 flex gap-4 items-start">
            <div className="mono text-xs text-signal-cyan tabular-nums pt-0.5 shrink-0">
              {String(i + 1).padStart(2, "0")}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium leading-snug text-foreground text-pretty">
                {p.title}
              </h3>
              {p.source && (
                <p className="mt-1 text-xs text-muted-foreground italic">{p.source}</p>
              )}
            </div>
            <a
              href={p.url}
              target="_blank"
              rel="noreferrer"
              className="mono text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0 pt-0.5 max-w-[200px] truncate"
              title={p.url}
            >
              source
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverviewBody({ plan }: { plan: Plan }) {
  const { overview } = plan;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-1.5">
          Primary goal
        </p>
        <p className="text-[15px] leading-relaxed text-foreground text-pretty">
          {overview.primary_goal}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-1.5">
          Validation approach
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {overview.validation_approach}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-2">
          Success criteria
        </p>
        <ul className="space-y-2">
          {overview.success_criteria.map((c, i) => (
            <li key={i} className="flex gap-2.5 text-sm">
              <span className="mt-2 size-1.5 rounded-full bg-signal-mint shrink-0" />
              <span className="text-foreground/90">{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ProtocolBody({ plan }: { plan: Plan }) {
  return (
    <ol className="space-y-2.5">
      {plan.protocol.steps.map((step) => (
        <li
          key={step.n}
          className="group relative rounded-xl border border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3 transition-colors p-3.5"
        >
          <div className="flex items-start gap-3">
            <div className="mono text-xs text-muted-foreground tabular-nums shrink-0 pt-0.5">
              {String(step.n).padStart(2, "0")}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] mono text-muted-foreground">
                  {step.duration_hours}h
                </span>
                {step.citations.slice(0, 2).map((c, i) => (
                  <a
                    key={i}
                    href={c.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] uppercase tracking-wider mono text-signal-cyan bg-signal-cyan/10 border border-signal-cyan/20 rounded px-1.5 py-0.5 hover:bg-signal-cyan/20 transition-colors flex items-center gap-1"
                  >
                    {c.label ?? "ref"} <ExternalLink className="size-2.5" />
                  </a>
                ))}
              </div>
              <h4 className="mt-1.5 text-sm font-medium text-foreground">{step.title}</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                {step.description}
              </p>
            </div>
            <button
              aria-label="Annotate step"
              className="opacity-0 group-hover:opacity-100 transition-opacity size-7 rounded-md border border-border-strong bg-surface-3 grid place-items-center text-muted-foreground hover:text-primary hover:border-primary/40 shrink-0"
            >
              <Pencil className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>
        </li>
      ))}
    </ol>
  );
}

const PHASE_COLORS = [
  "bg-signal-cyan/70 border-signal-cyan",
  "bg-signal-violet/70 border-signal-violet",
  "bg-signal-mint/70 border-signal-mint",
  "bg-signal-amber/70 border-signal-amber",
  "bg-signal-rose/70 border-signal-rose",
];

function TimelineBody({ plan }: { plan: Plan }) {
  const totalWeeks = Math.max(plan.timeline.weeks, 1);
  return (
    <div>
      {/* Week ruler */}
      <div
        className="grid gap-1 pl-[140px] mb-2"
        style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: totalWeeks }).map((_, i) => (
          <div
            key={i}
            className="text-[10px] mono text-muted-foreground text-center tabular-nums"
          >
            W{i + 1}
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {plan.timeline.phases.map((p, i) => {
          const leftPct = (p.start_week / totalWeeks) * 100;
          const widthPct = (p.duration_weeks / totalWeeks) * 100;
          const colorClass = PHASE_COLORS[i % PHASE_COLORS.length];
          return (
            <div key={p.id} className="flex items-center gap-3">
              <div className="w-[132px] shrink-0 text-xs text-foreground/90 truncate" title={p.name}>
                {p.name}
              </div>
              <div className="relative flex-1 h-7 rounded-md bg-surface-2 border border-border overflow-hidden">
                <div
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
                >
                  {Array.from({ length: totalWeeks }).map((_, j) => (
                    <div key={j} className="border-r border-border/50 last:border-r-0" />
                  ))}
                </div>
                <div
                  className={`absolute top-1 bottom-1 rounded border ${colorClass} flex items-center px-2`}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  <span className="mono text-[10px] text-background/90 font-semibold tabular-nums">
                    {p.duration_weeks}w
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-[11px] mono text-muted-foreground flex-wrap gap-2">
        <span className="truncate">Critical path: {plan.timeline.critical_path.join(" → ")}</span>
        <span>Slack: {plan.timeline.slack_weeks} weeks</span>
      </div>
    </div>
  );
}

function BudgetBody({ plan }: { plan: Plan }) {
  const reagents = plan.materials.items;
  const lines = plan.budget.lines;
  const total = plan.budget.total_usd;

  return (
    <div className="space-y-6">
      {/* Materials */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider mono text-muted-foreground mb-2">
          Reagents & materials
        </h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-wider mono text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Reagent</th>
                  <th className="px-4 py-2.5 font-medium">Catalog #</th>
                  <th className="px-4 py-2.5 font-medium">Supplier</th>
                  <th className="px-4 py-2.5 font-medium">Qty</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cost (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {reagents.map((r, i) => (
                  <tr key={`${r.catalog_number}-${i}`} className="hover:bg-surface-2/60 transition-colors">
                    <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                    <td className="px-4 py-2.5 mono text-xs text-signal-cyan">
                      <a
                        href={r.catalog_url}
                        target="_blank"
                        rel="noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        {r.catalog_number} <ExternalLink className="size-2.5" />
                      </a>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.supplier}</td>
                    <td className="px-4 py-2.5 mono text-xs text-muted-foreground tabular-nums">
                      {r.qty}
                    </td>
                    <td className="px-4 py-2.5 text-right mono text-sm tabular-nums">
                      ${r.total_cost_usd.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-surface-2/60">
                  <td colSpan={4} className="px-4 py-3 text-right text-[11px] uppercase tracking-wider mono text-muted-foreground">
                    Materials subtotal
                  </td>
                  <td className="px-4 py-3 text-right mono text-sm tabular-nums">
                    ${plan.materials.total_usd.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </section>

      {/* Budget breakdown */}
      <section>
        <h3 className="text-[11px] uppercase tracking-wider mono text-muted-foreground mb-2">
          Budget breakdown
        </h3>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-2 text-left text-[11px] uppercase tracking-wider mono text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 font-medium text-right">Cost (USD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {lines.map((l, i) => (
                <tr key={i} className="hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-2.5">
                    <span className="text-[10px] uppercase tracking-wider mono text-signal-mint bg-signal-mint/10 border border-signal-mint/20 rounded px-1.5 py-0.5">
                      {l.category}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-foreground/90">{l.description}</td>
                  <td className="px-4 py-2.5 text-right mono text-sm tabular-nums">
                    ${l.cost_usd.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2/60">
                <td colSpan={2} className="px-4 py-3 text-right text-[11px] uppercase tracking-wider mono text-muted-foreground">
                  Total estimated budget
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-display italic text-2xl text-signal-mint tabular-nums">
                    ${total.toLocaleString()}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
