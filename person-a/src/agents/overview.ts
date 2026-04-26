import { generateJSON } from "../llm/client.js";
import { OverviewSchema } from "../shared/types.js";
import { AgentContext, COMMON_RULES, formatCorrections, formatRefs } from "./base.js";

export async function runOverviewAgent(ctx: AgentContext) {
  const system = `${COMMON_RULES}
You produce the OVERVIEW section: primary_goal, validation_approach, success_criteria.
Schema: { primary_goal: string, validation_approach: string, success_criteria: string[] (>=1) }`;

  const user = `HYPOTHESIS:
${ctx.hypothesis}

DOMAIN: ${ctx.domain}
EXPERIMENT TYPE: ${ctx.experiment_type}

RELATED PAPERS:
${formatRefs(ctx.retrieval.papers)}

PRIOR REVIEWER CORRECTIONS (apply when applicable):
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    onDelta: ctx.onDelta,
    agent: "overview",
    system,
    user,
    schema: OverviewSchema,
  });
}
