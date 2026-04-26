import { Monitor, ClipboardList, Clock, Vault, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import type { Plan, Reagent } from "@/lib/mock-data";

function CardHeader({
  index,
  Icon,
  kicker,
  title,
}: {
  index: string;
  Icon: typeof Monitor;
  kicker: string;
  title: string;
}) {
  return (
    <header className="flex items-center gap-3">
      <div className="size-10 rounded-xl bg-surface-3 border border-border-strong grid place-items-center">
        <Icon className="size-5 text-muted-foreground" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mono">
          {index} · {kicker}
        </p>
        <h2 className="font-display text-2xl leading-tight italic">{title}</h2>
      </div>
    </header>
  );
}

export function OverviewCard({ plan }: { plan: Plan }) {
  return (
    <article className="bento-card p-6 sm:p-7">
      <CardHeader index="02" Icon={Monitor} kicker="The Screen" title="Overview" />
      <div className="mt-5 space-y-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-1.5">
            Primary goal
          </p>
          <p className="text-[15px] leading-relaxed text-foreground text-pretty">
            {plan.overview.goal}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-1.5">
            Validation approach
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
            {plan.overview.approach}
          </p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mono mb-2">
            Success criteria
          </p>
          <ul className="space-y-2">
            {plan.overview.successCriteria.map((c) => (
              <li key={c} className="flex gap-2.5 text-sm">
                <span className="mt-2 size-1.5 rounded-full bg-signal-mint shrink-0" />
                <span className="text-foreground/90">{c}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function ProtocolCard({ plan }: { plan: Plan }) {
  return (
    <article className="bento-card p-6 sm:p-7 flex flex-col">
      <CardHeader index="03" Icon={ClipboardList} kicker="The Checklist" title="Protocol" />

      <ol className="mt-5 max-h-[520px] overflow-y-auto pr-2 -mr-2 space-y-2.5 scrollbar-thin">
        {plan.protocol.map((step, i) => (
          <li
            key={step.id}
            className="group relative rounded-xl border border-border bg-surface-2 hover:border-border-strong hover:bg-surface-3 transition-colors p-3.5"
          >
            <div className="flex items-start gap-3">
              <div className="mono text-xs text-muted-foreground tabular-nums shrink-0 pt-0.5">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase tracking-wider mono text-signal-cyan bg-signal-cyan/10 border border-signal-cyan/20 rounded px-1.5 py-0.5">
                    {step.phase}
                  </span>
                  <span className="text-[10px] mono text-muted-foreground">{step.duration}</span>
                </div>
                <h4 className="mt-1.5 text-sm font-medium text-foreground">{step.title}</h4>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                  {step.detail}
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
    </article>
  );
}

export function TimelineCard({ plan }: { plan: Plan }) {
  const totalWeeks = 10;
  const colorMap: Record<string, string> = {
    "signal-cyan": "bg-signal-cyan/70 border-signal-cyan",
    "signal-violet": "bg-signal-violet/70 border-signal-violet",
    "signal-mint": "bg-signal-mint/70 border-signal-mint",
    "signal-amber": "bg-signal-amber/70 border-signal-amber",
    "signal-rose": "bg-signal-rose/70 border-signal-rose",
  };

  return (
    <article className="bento-card p-6 sm:p-7">
      <CardHeader index="04" Icon={Clock} kicker="The Clock" title="Timeline · 10 weeks" />

      <div className="mt-6">
        {/* Week ruler */}
        <div className="grid grid-cols-10 gap-1 pl-[140px] mb-2">
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
          {plan.timeline.map((p) => {
            const leftPct = ((p.startWeek - 1) / totalWeeks) * 100;
            const widthPct = (p.weeks / totalWeeks) * 100;
            return (
              <div key={p.id} className="flex items-center gap-3">
                <div className="w-[132px] shrink-0 text-xs text-foreground/90 truncate">
                  {p.name}
                </div>
                <div className="relative flex-1 h-7 rounded-md bg-surface-2 border border-border overflow-hidden">
                  {/* week gridlines */}
                  <div className="absolute inset-0 grid grid-cols-10">
                    {Array.from({ length: totalWeeks }).map((_, i) => (
                      <div key={i} className="border-r border-border/50 last:border-r-0" />
                    ))}
                  </div>
                  <div
                    className={`absolute top-1 bottom-1 rounded border ${colorMap[p.color]} flex items-center px-2`}
                    style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  >
                    <span className="mono text-[10px] text-background/90 font-semibold tabular-nums">
                      {p.weeks}w
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 pt-4 border-t border-border flex items-center justify-between text-[11px] mono text-muted-foreground">
          <span>Critical path: P1 → P2 → P3 → P4 → P5 → P6</span>
          <span>Slack: 0 weeks</span>
        </div>
      </div>
    </article>
  );
}

export function BudgetCard({ plan }: { plan: Plan }) {
  const [reagents, setReagents] = useState<Reagent[]>(plan.reagents);
  const total = reagents.reduce((s, r) => s + r.cost, 0);

  const updateCost = (idx: number, val: string) => {
    const num = Number(val.replace(/[^0-9.]/g, ""));
    if (Number.isNaN(num)) return;
    setReagents((rs) => rs.map((r, i) => (i === idx ? { ...r, cost: num } : r)));
  };

  return (
    <article className="bento-card p-6 sm:p-7">
      <CardHeader index="05" Icon={Vault} kicker="The Vault" title="Materials & Budget" />

      <div className="mt-5 overflow-hidden rounded-xl border border-border">
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
                <tr key={r.catalog} className="group hover:bg-surface-2/60 transition-colors">
                  <td className="px-4 py-2.5 text-foreground">{r.name}</td>
                  <td className="px-4 py-2.5 mono text-xs text-signal-cyan">{r.catalog}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.supplier}</td>
                  <td className="px-4 py-2.5 mono text-xs text-muted-foreground tabular-nums">
                    {r.qty}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input
                      value={`$${r.cost.toLocaleString()}`}
                      onChange={(e) => updateCost(i, e.target.value)}
                      className="mono text-sm tabular-nums bg-transparent text-foreground text-right w-24 px-1.5 py-0.5 rounded border border-transparent group-hover:border-border-strong focus:border-primary/60 focus:bg-surface-3 outline-none transition-colors"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-surface-2/60">
                <td colSpan={3} className="px-4 py-3">
                  <button className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 transition-colors">
                    <Plus className="size-3.5" /> Add line item
                  </button>
                </td>
                <td className="px-4 py-3 text-right text-[11px] uppercase tracking-wider mono text-muted-foreground">
                  Total Estimated Budget
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
      </div>
    </article>
  );
}
