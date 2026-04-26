// Fast novelty-only QC pass. Used immediately after the user submits
// their hypothesis (Stage 1 → Stage 2) so the Paper modal can show real
// retrieved papers without waiting for the full ~10s pipeline.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { runNoveltyAgent } from "@/server/agents/novelty";
import { pickRetrieval } from "@/server/retrieval";

const Input = z.object({
  hypothesis: z.string().min(10).max(2000),
});

export const runQC = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }) => {
    try {
      const retrieval = pickRetrieval();
      const papers = await retrieval.papers(data.hypothesis);
      const result = await runNoveltyAgent({
        hypothesis: data.hypothesis,
        papers,
      });
      return {
        ok: true as const,
        novelty: result.data,
        papers,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[runQC] failed:", message);
      return { ok: false as const, error: message };
    }
  });
