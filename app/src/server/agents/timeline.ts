import { generateJSON } from "../llm/client";
import { TimelineSchema, type Plan } from "../shared/types";
import { AgentContext, COMMON_RULES, formatCorrections } from "./base";

export async function runTimelineAgent(
  ctx: AgentContext,
  protocol: Plan["protocol"]
) {
  const system = `${COMMON_RULES}
You produce the TIMELINE section. Phases must collectively cover every protocol step.
Schema: { weeks:int>=1, phases:[{id:"P#", name, start_week:int>=0, duration_weeks:int>=1, depends_on:[id]}] (>=1), critical_path:[id] (>=1), slack_weeks:int>=0 }
Constraints:
- Every phase id is unique and shaped "P1","P2",...
- depends_on entries must reference earlier phases
- weeks = max(start_week + duration_weeks) across phases`;

  const user = `EXPERIMENT TYPE: ${ctx.experiment_type}

PROTOCOL STEPS:
${protocol.steps.map((s) => `${s.n}. ${s.title} (~${s.duration_hours}h)`).join("\n")}

Plan a realistic week-level Gantt. Group steps into 4-7 phases.

PRIOR REVIEWER CORRECTIONS:
${formatCorrections(ctx.corrections)}

Return the JSON object now.`;

  return generateJSON({
    onDelta: ctx.onDelta,
    agent: "timeline",
    system,
    user,
    schema: TimelineSchema,
  });
}
