// Eval harness — runs all 4 brief samples, asserts hard quality bars.
// Exit code is non-zero on any failure. Use in CI to block bad deploys.

import "./bootstrap.js";
import { orchestrate } from "./orchestrator.js";
import { SAMPLES } from "./samples.js";
import { PlanSchema, type Plan } from "./shared/types.js";
import { consistencyPass, LeadPIRejection } from "./agents/leadPI.js";

interface Check {
  name: string;
  ok: boolean;
  detail?: string;
}

function checkPlan(plan: Plan): Check[] {
  const checks: Check[] = [];

  // Schema (already validated by orchestrator, but re-assert)
  const parsed = PlanSchema.safeParse(plan);
  checks.push({ name: "schema", ok: parsed.success, detail: parsed.success ? undefined : parsed.error.message });

  // Every protocol step has >=1 citation
  const stepsOk = plan.protocol.steps.every((s) => s.citations.length >= 1);
  checks.push({ name: "protocol citations", ok: stepsOk });

  // Every reagent has catalog # + URL
  const matsOk = plan.materials.items.every(
    (m) => m.catalog_number.trim() && /^https?:\/\//.test(m.catalog_url)
  );
  checks.push({ name: "materials catalog refs", ok: matsOk });

  // Every budget line has >=1 citation URL
  const budgetCitesOk = plan.budget.lines.every(
    (l) => l.citations.length >= 1 && l.citations.some((c) => /^https?:\/\//.test(c.url))
  );
  checks.push({ name: "budget line citations", ok: budgetCitesOk });

  // Materials total = sum(items)
  const matSum = plan.materials.items.reduce((s, m) => s + m.total_cost_usd, 0);
  const matsTotalOk = Math.abs(matSum - plan.materials.total_usd) < 1;
  checks.push({
    name: "materials total math",
    ok: matsTotalOk,
    detail: matsTotalOk ? undefined : `sum=${matSum} vs total=${plan.materials.total_usd}`,
  });

  // Budget total = sum(lines)
  const lineSum = plan.budget.lines.reduce((s, l) => s + l.cost_usd, 0);
  const budgetTotalOk = Math.abs(lineSum - plan.budget.total_usd) < 1;
  checks.push({
    name: "budget total math",
    ok: budgetTotalOk,
    detail: budgetTotalOk ? undefined : `sum=${lineSum} vs total=${plan.budget.total_usd}`,
  });

  // Timeline weeks = max(start+duration)
  const computedWeeks = plan.timeline.phases.reduce(
    (m, p) => Math.max(m, p.start_week + p.duration_weeks),
    0
  );
  checks.push({
    name: "timeline weeks coverage",
    ok: computedWeeks === plan.timeline.weeks,
    detail: computedWeeks === plan.timeline.weeks ? undefined : `computed=${computedWeeks} vs weeks=${plan.timeline.weeks}`,
  });

  // Validation: >=1 metric, >=1 control
  checks.push({
    name: "validation completeness",
    ok: plan.validation.metrics.length >= 1 && plan.validation.controls.length >= 1,
  });

  return checks;
}

async function main() {
  let totalFails = 0;
  let totalLatency = 0;

  for (const s of SAMPLES) {
    const t0 = Date.now();
    process.stdout.write(`\n=== ${s.id} : ${s.label} ===\n`);
    let plan: Plan;
    try {
      plan = await orchestrate({ hypothesis: s.hypothesis });
    } catch (err) {
      console.error(`  FATAL: orchestrate threw — ${(err as Error).message}`);
      totalFails++;
      continue;
    }
    const dt = Date.now() - t0;
    totalLatency += dt;

    const checks = checkPlan(plan);
    for (const c of checks) {
      const sign = c.ok ? "PASS" : "FAIL";
      process.stdout.write(`  [${sign}] ${c.name}${c.detail ? ` — ${c.detail}` : ""}\n`);
      if (!c.ok) totalFails++;
    }
    process.stdout.write(
      `  plan: ${plan.protocol.steps.length} steps, ` +
      `${plan.materials.items.length} reagents, ` +
      `$${plan.budget.total_usd.toLocaleString()} total, ` +
      `${plan.timeline.weeks}w timeline, ` +
      `${plan.provenance.corrections_applied} corrections applied — ${dt}ms\n`
    );
  }

  process.stdout.write(
    `\n========\n${totalFails === 0 ? "ALL PASS" : `${totalFails} FAIL(S)`} in ${totalLatency}ms total\n`
  );

  // Lead PI rejection self-test: corrupt a passing plan, confirm Lead PI throws.
  process.stdout.write(`\n=== Lead PI rejection self-test ===\n`);
  try {
    const baseline = await orchestrate({ hypothesis: SAMPLES[0]!.hypothesis });
    const broken: Plan = JSON.parse(JSON.stringify(baseline));
    // Drop all timeline phases — fewer than protocol steps → must reject.
    broken.timeline.phases = [];
    broken.timeline.weeks = 0;
    broken.timeline.critical_path = [];
    try {
      consistencyPass(broken);
      process.stdout.write(`  [FAIL] Lead PI accepted a corrupted plan\n`);
      totalFails++;
    } catch (e) {
      if (e instanceof LeadPIRejection) {
        process.stdout.write(`  [PASS] Lead PI rejected: ${e.violations.length} violation(s)\n`);
      } else {
        process.stdout.write(`  [FAIL] unexpected error: ${(e as Error).message}\n`);
        totalFails++;
      }
    }
  } catch (e) {
    process.stdout.write(`  [SKIP] could not generate baseline plan: ${(e as Error).message}\n`);
  }

  process.exit(totalFails === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("eval crashed:", err);
  process.exit(2);
});
