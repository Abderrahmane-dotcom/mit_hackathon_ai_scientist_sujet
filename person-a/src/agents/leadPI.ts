// Lead PI agent — deterministic consistency pass over the assembled Plan.
// Catches mismatches that the sub-agents may miss: budget total math, timeline
// coverage, missing citations. Auto-repairs cheap errors; throws on hard ones.

import type { Plan } from "../shared/types.js";

export class LeadPIRejection extends Error {
  constructor(public readonly violations: string[]) {
    super(`Lead PI rejected the plan:\n- ${violations.join("\n- ")}`);
    this.name = "LeadPIRejection";
  }
}

export interface ConsistencyReport {
  fixed: string[];
  warnings: string[];
}

export function consistencyPass(plan: Plan): { plan: Plan; report: ConsistencyReport } {
  const fixed: string[] = [];
  const warnings: string[] = [];
  const violations: string[] = [];

  // 1) Materials totals
  const matSum = round2(plan.materials.items.reduce((s, m) => s + m.total_cost_usd, 0));
  if (Math.abs(matSum - plan.materials.total_usd) > 0.5) {
    plan.materials.total_usd = matSum;
    fixed.push(`materials.total_usd recomputed to $${matSum}`);
  }

  // 2) Budget totals = sum(lines)
  const lineSum = round2(plan.budget.lines.reduce((s, l) => s + l.cost_usd, 0));
  if (Math.abs(lineSum - plan.budget.total_usd) > 1) {
    plan.budget.total_usd = lineSum;
    fixed.push(`budget.total_usd recomputed to $${lineSum}`);
  }

  // 3) Budget must contain a 'reagents' line if materials are non-empty.
  //    If the line is too low to cover materials.total_usd, auto-repair by
  //    bumping it (and re-summing total) — this is an arithmetic mismatch,
  //    not a structural failure.
  if (plan.materials.items.length > 0) {
    const reagentLine = plan.budget.lines.find((l) => l.category === "reagents");
    if (!reagentLine) {
      violations.push(
        `budget has no 'reagents' line but materials list contains ${plan.materials.items.length} item(s)`
      );
    } else if (reagentLine.cost_usd + 1 < plan.materials.total_usd) {
      const old = reagentLine.cost_usd;
      reagentLine.cost_usd = plan.materials.total_usd;
      const newTotal = round2(plan.budget.lines.reduce((s, l) => s + l.cost_usd, 0));
      plan.budget.total_usd = newTotal;
      fixed.push(
        `budget.reagents bumped from $${old} to $${reagentLine.cost_usd} to cover materials; total=$${newTotal}`
      );
    }
  }

  // 4) Timeline weeks consistency (auto-repair)
  const computedWeeks = plan.timeline.phases.reduce(
    (m, p) => Math.max(m, p.start_week + p.duration_weeks),
    0
  );
  if (computedWeeks !== plan.timeline.weeks) {
    plan.timeline.weeks = computedWeeks;
    fixed.push(`timeline.weeks recomputed to ${computedWeeks}`);
  }

  // 5) HARD: timeline must cover all protocol steps. We require at least one
  //    timeline phase per protocol step (a coarse but objective coverage rule),
  //    and total weeks > 0.
  if (plan.timeline.weeks <= 0) {
    violations.push(`timeline.weeks must be > 0 (got ${plan.timeline.weeks})`);
  }
  if (plan.timeline.phases.length < plan.protocol.steps.length) {
    violations.push(
      `timeline has ${plan.timeline.phases.length} phases but protocol has ${plan.protocol.steps.length} steps — coverage insufficient`
    );
  }

  // 6) Timeline depends_on must reference existing earlier phases
  const phaseIds = new Set(plan.timeline.phases.map((p) => p.id));
  for (const p of plan.timeline.phases) {
    for (const d of p.depends_on) {
      if (!phaseIds.has(d)) warnings.push(`timeline phase ${p.id} depends on missing phase ${d}`);
    }
  }

  // 7) Critical path entries must exist
  for (const id of plan.timeline.critical_path) {
    if (!phaseIds.has(id)) warnings.push(`timeline.critical_path references missing phase ${id}`);
  }

  // 8) HARD: every protocol step has >=1 citation (Zod min(1) already enforces;
  //    we additionally check the URL is non-empty).
  for (const s of plan.protocol.steps) {
    if (!s.citations.length || !s.citations.some((c) => /^https?:\/\//.test(c.url))) {
      violations.push(`protocol step ${s.n} has no valid citation URL`);
    }
  }

  // 9) HARD: every budget line has >=1 citation with a valid URL.
  for (let i = 0; i < plan.budget.lines.length; i++) {
    const line = plan.budget.lines[i]!;
    if (!line.citations.length || !line.citations.some((c) => /^https?:\/\//.test(c.url))) {
      violations.push(`budget.lines[${i}] (${line.category}) has no valid citation URL`);
    }
  }

  // 10) Materials must have catalog_url and catalog_number (HARD on URL).
  for (const m of plan.materials.items) {
    if (!/^https?:\/\//.test(m.catalog_url)) {
      violations.push(`material "${m.name}" has invalid catalog_url`);
    }
    if (!m.catalog_number.trim()) {
      warnings.push(`material "${m.name}" missing catalog_number`);
    }
  }

  if (violations.length) throw new LeadPIRejection(violations);

  return { plan, report: { fixed, warnings } };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
