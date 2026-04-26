import { generateJSON } from "../llm/client.js";
import { PlanSchema } from "../shared/types.js";
import { COMMON_RULES, formatRefs } from "./base.js";
import type { RetrievalResult } from "../retrieval/mock.js";

const NoveltyOnly = PlanSchema.shape.novelty;

export async function runNoveltyAgent(args: {
  hypothesis: string;
  papers: RetrievalResult[];
  onDelta?: (chunk: string) => void;
}) {
  const system = `${COMMON_RULES}
You produce the LITERATURE NOVELTY signal.
Schema: { signal: "not_found"|"similar_work_exists"|"exact_match", refs: [{title, url, source?}] (<=5) }
Rules:
- "exact_match" only if a paper describes the same intervention + outcome.
- "similar_work_exists" if related but not identical.
- "not_found" only if retrieval is empty or clearly off-topic.
- Refs MUST come from the retrieval block (verbatim title + url).`;

  const user = `HYPOTHESIS:
${args.hypothesis}

RETRIEVED PAPERS:
${formatRefs(args.papers)}

Return the JSON object now.`;

  return generateJSON({
    agent: "novelty",
    system,
    user,
    schema: NoveltyOnly,
    onDelta: args.onDelta,
  });
}
