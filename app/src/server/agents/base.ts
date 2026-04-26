import type { Correction } from "../corrections/mock";
import type { RetrievalResult } from "../retrieval/mock";

export interface AgentContext {
  hypothesis: string;
  domain: string;
  experiment_type: string;
  retrieval: {
    protocols: RetrievalResult[];
    suppliers: RetrievalResult[];
    papers: RetrievalResult[];
  };
  corrections: Correction[]; // already filtered to this section + experiment_type
  onDelta?: (chunk: string) => void; // optional token streaming sink
}

export function formatRefs(items: RetrievalResult[]): string {
  if (!items.length) return "(no retrieval hits — proceed with general best practice)";
  return items
    .map((r, i) => `[${i + 1}] ${r.title} — ${r.url}${r.snippet ? `\n    ${r.snippet}` : ""}`)
    .join("\n");
}

export function formatCorrections(cs: Correction[]): string {
  if (!cs.length) return "(no prior reviewer corrections for this experiment type)";
  return cs
    .map(
      (c, i) =>
        `[#${i + 1}] In a similar prior experiment, a senior scientist corrected:\n` +
        `       BEFORE: ${c.before}\n` +
        `       AFTER:  ${c.after}\n` +
        `       WHY:    ${c.rationale}\n` +
        `       Apply this correction in the current plan when applicable.`
    )
    .join("\n");
}

export const COMMON_RULES = `
You are an expert lab scientist generating part of an experiment plan.
Hard rules:
- Output strictly valid JSON matching the schema described.
- Be operationally realistic: a real PI must be able to act on it.
- Cite real-looking URLs from the retrieval block; never invent sources outside it.
- Prefer specific over vague (concentrations, durations, temperatures, n).
- Never include prose outside the JSON.
`.trim();
