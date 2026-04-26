import { generateJSON } from "../llm/client.js";
import { BudgetSchema, type Plan } from "../shared/types.js";
import { AgentContext, COMMON_RULES, formatCorrections } from "./base.js";

export async function runBudgetAgent(
  ctx: AgentContext,
  materials: Plan["materials"],
  timeline: Plan["timeline"]
) {
  const system = `${COMMON_RULES}
You produce the BUDGET section. It MUST cover the materials list and the timeline labor.
Categories allowed: reagents, consumables, equipment, labor, overhead, other.
Schema: { lines: [{category, description, cost_usd, citations: [{url, title?, snippet?}] (>=1)}] (>=1), labor_usd, overhead_usd, total_usd }
EVERY line MUST include at least one citation URL backing the cost estimate (vendor catalog, salary survey, NIH F&A rate page, etc.).
Constraint: total_usd MUST equal sum(lines[].cost_usd) within $1.`;

  const user = `MATERIALS TOTAL: $${materials.total_usd.toFixed(2)}
MATERIALS ITEMS:
${materials.items.map((m) => `- ${m.name}: $${m.total_cost_usd}`).join("\n")}

TIMELINE: ${timeline.weeks} weeks, ${timeline.phases.length} phases.

Build a realistic budget. Labor should reflect ~${Math.round(timeline.weeks * 20)} scientist-hours at typical academic loaded rates. Add ~15% overhead.

PRIOR REVIEWER CORRECTIONS:
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    onDelta: ctx.onDelta,
    agent: "budget",
    system,
    user,
    schema: BudgetSchema,
  });
}
