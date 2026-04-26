import { generateJSON } from "../llm/client";
import { MaterialsSchema } from "../shared/types";
import { AgentContext, COMMON_RULES, formatCorrections, formatRefs } from "./base";

export async function runMaterialsAgent(ctx: AgentContext) {
  const system = `${COMMON_RULES}
You produce the MATERIALS section. Every reagent MUST have a real-looking
catalog_number and catalog_url drawn from the supplier retrieval block.
Reject any reagent you cannot back with a supplier URL.
Schema: { items: [{ name, catalog_number, supplier, catalog_url, qty, unit_cost_usd, total_cost_usd, notes? }] (>=1), total_usd }
Compute total_usd = sum(items[].total_cost_usd).`;

  const user = `HYPOTHESIS:
${ctx.hypothesis}

EXPERIMENT TYPE: ${ctx.experiment_type}

SUPPLIER SOURCES (use these URLs as catalog_url):
${formatRefs(ctx.retrieval.suppliers)}

PRIOR REVIEWER CORRECTIONS (apply when applicable):
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    onDelta: ctx.onDelta,
    agent: "materials",
    system,
    user,
    schema: MaterialsSchema,
  });
}
