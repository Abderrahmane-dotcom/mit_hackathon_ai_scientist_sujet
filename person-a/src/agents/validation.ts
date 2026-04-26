import { generateJSON } from "../llm/client.js";
import { ValidationSchema } from "../shared/types.js";
import { AgentContext, COMMON_RULES, formatCorrections } from "./base.js";

export async function runValidationAgent(ctx: AgentContext) {
  const system = `${COMMON_RULES}
You produce the VALIDATION section: success metrics with numerical thresholds, controls, and a stats plan.
Schema: { metrics:[{name, threshold, method}] (>=1), controls:[string] (>=1), statistics:string }
Be specific (e.g. n per arm, alpha, power, exact statistical test).`;

  const user = `HYPOTHESIS:
${ctx.hypothesis}

EXPERIMENT TYPE: ${ctx.experiment_type}

PRIOR REVIEWER CORRECTIONS:
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    onDelta: ctx.onDelta,
    agent: "validation",
    system,
    user,
    schema: ValidationSchema,
  });
}
