import { FileText, ExternalLink, Sparkles, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Plan } from "@/lib/mock-data";

const NOVELTY_CONFIG = {
  similar: {
    label: "Similar Work Exists",
    Icon: AlertTriangle,
    accent: "text-signal-amber",
    bg: "bg-signal-amber/10",
    border: "border-signal-amber/30",
    dot: "bg-signal-amber",
  },
  partial: {
    label: "Partial Overlap",
    Icon: Sparkles,
    accent: "text-signal-cyan",
    bg: "bg-signal-cyan/10",
    border: "border-signal-cyan/30",
    dot: "bg-signal-cyan",
  },
  novel: {
    label: "Not Found — Novel Direction",
    Icon: CheckCircle2,
    accent: "text-signal-mint",
    bg: "bg-signal-mint/10",
    border: "border-signal-mint/30",
    dot: "bg-signal-mint",
  },
} as const;

export function LiteratureQC({
  plan,
  onGenerate,
  generating,
  generated,
}: {
  plan: Plan;
  onGenerate: () => void;
  generating: boolean;
  generated: boolean;
}) {
  const cfg = NOVELTY_CONFIG[plan.novelty];

  return (
    <article className="bento-card p-6 sm:p-8">
      <header className="flex items-start justify-between gap-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-surface-3 border border-border-strong grid place-items-center">
            <FileText className="size-5 text-muted-foreground" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mono">
              01 · Literature QC
            </p>
            <h2 className="font-display text-2xl sm:text-[28px] leading-tight italic">
              Novelty signal
            </h2>
          </div>
        </div>

        <div
          className={`flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.accent}`}
        >
          <span className={`size-1.5 rounded-full ${cfg.dot} animate-pulse`} />
          <cfg.Icon className="size-3.5" strokeWidth={2} />
          {cfg.label}
        </div>
      </header>

      <p className="mt-5 text-sm text-muted-foreground max-w-2xl text-pretty">
        We screened ~120k papers across arXiv, PubMed and Semantic Scholar. Three references show
        meaningful overlap with your hypothesis — review before committing bench time.
      </p>

      <ul className="mt-6 divide-y divide-border">
        {plan.papers.map((p) => (
          <li key={p.doi} className="py-4 flex gap-4 items-start group">
            <div className="mono text-xs text-signal-cyan tabular-nums pt-0.5">
              {(p.similarity * 100).toFixed(0)}%
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium leading-snug text-foreground text-pretty">
                {p.title}
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.authors} · <span className="italic">{p.venue}</span> · {p.year}
              </p>
            </div>
            <a
              href={`https://doi.org/${p.doi}`}
              target="_blank"
              rel="noreferrer"
              className="mono text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 shrink-0 pt-0.5"
            >
              {p.doi}
              <ExternalLink className="size-3" />
            </a>
          </li>
        ))}
      </ul>

      <div className="mt-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pt-5 border-t border-border">
        <p className="text-xs text-muted-foreground max-w-md">
          Proceeding will assemble a 10-week protocol, timeline, and itemized budget grounded in
          these references.
        </p>
        <button
          onClick={onGenerate}
          disabled={generating || generated}
          className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <Sparkles className="size-4" strokeWidth={2} />
          {generated
            ? "Plan generated below"
            : generating
              ? "Synthesizing plan…"
              : "Generate Full Experiment Plan"}
        </button>
      </div>
    </article>
  );
}
