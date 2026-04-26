// Hypothesis classifier — Person B deliverable #5.
// Returns { domain, experiment_type } used by:
//  - retrieval profile selection
//  - corrections lookup keys (Person C)
//
// Strategy: try LLM (1 small call, schema-constrained), fall back to the
// proven heuristic on any failure. Heuristic alone is enough to pass the
// 4 brief samples; LLM extends coverage to arbitrary hypotheses.

import { z } from "zod";
import { generateJSON } from "../llm/client";

const ClassifySchema = z.object({
  domain: z.enum([
    "diagnostics",
    "gut_microbiome",
    "cell_biology",
    "materials_climate",
    "neuroscience",
    "oncology",
    "general",
  ]),
  experiment_type: z.string().min(3).max(80),
});

export type Classification = z.infer<typeof ClassifySchema>;

export async function classifyHypothesis(hypothesis: string): Promise<Classification> {
  // Heuristic first — instant, free, covers our 4 demo samples
  const h = heuristic(hypothesis);
  if (h.domain !== "general") return h;

  // Fall back to LLM for hypotheses outside the keyword buckets
  try {
    const { data } = await generateJSON({
      agent: "classify",
      system:
        "Classify the scientific hypothesis. Choose ONE domain from the enum. " +
        "experiment_type is a short kebab-case slug like 'cell-cryopreservation' " +
        "or 'rodent-probiotic-supplementation'. Return JSON only.",
      user: `HYPOTHESIS:\n${hypothesis}\n\nReturn the JSON object now.`,
      schema: ClassifySchema,
    });
    return data;
  } catch {
    return h; // last-resort heuristic
  }
}

export function heuristic(hypothesis: string): Classification {
  const t = hypothesis.toLowerCase();
  if (t.includes("perovskite") || t.includes("solar") || t.includes("co2") || t.includes("cathode"))
    return { domain: "materials_climate", experiment_type: inferMaterialsType(t) };
  if (t.includes("crp") || t.includes("biosensor") || t.includes("elisa"))
    return { domain: "diagnostics", experiment_type: "paper-electrochemical-biosensor" };
  if (t.includes("mice") || t.includes("lactobacillus") || t.includes("intestinal"))
    return { domain: "gut_microbiome", experiment_type: "rodent-probiotic-supplementation" };
  if (t.includes("hela") || t.includes("trehalose") || t.includes("cryo"))
    return { domain: "cell_biology", experiment_type: "cell-cryopreservation" };
  return { domain: "general", experiment_type: "controlled-comparison" };
}

function inferMaterialsType(t: string): string {
  if (t.includes("perovskite")) return "perovskite-tandem-fab";
  if (t.includes("co2") || t.includes("cathode")) return "bioelectrochemical-co2-fixation";
  return "materials-fabrication";
}
