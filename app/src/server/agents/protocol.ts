import { generateJSON } from "../llm/client";
import { ProtocolSchema } from "../shared/types";
import { AgentContext, COMMON_RULES, formatCorrections, formatRefs } from "./base";

export async function runProtocolAgent(ctx: AgentContext) {
  const system = `${COMMON_RULES}
You produce the PROTOCOL section: an ordered list of >=3 concrete lab steps.
Each step MUST cite at least one URL drawn from the retrieval block.
Schema: { steps: [{ n:int>=1, title:str, description:str, duration_hours:number>=0, citations:[{url, label?}] (>=1) }] }`;

  const user = `HYPOTHESIS:
${ctx.hypothesis}

DOMAIN: ${ctx.domain}
EXPERIMENT TYPE: ${ctx.experiment_type}

PROTOCOL SOURCES (use these URLs for citations):
${formatRefs(ctx.retrieval.protocols)}

PRIOR REVIEWER CORRECTIONS (apply when applicable):
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    agent: "protocol",
    system,
    user,
    schema: ProtocolSchema,
    onDelta: ctx.onDelta,
  });
}
