// Browser-side SSE consumer for POST /api/plan.
// Calls onEvent for each orchestrator SectionEvent, resolves with the
// final Plan (validated server-side) or throws on error.

import type { Plan } from "@/server/shared/types";
import type { SectionEvent } from "@/server/orchestrator";

export type PlanStreamCallbacks = {
  onEvent?: (e: SectionEvent) => void;
  signal?: AbortSignal;
};

export async function streamPlan(
  hypothesis: string,
  cb: PlanStreamCallbacks = {},
): Promise<Plan> {
  const res = await fetch("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ hypothesis }),
    signal: cb.signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => "");
    throw new Error(`Plan request failed (${res.status}): ${text || res.statusText}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let plan: Plan | null = null;
  let errorMessage: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line (\n\n)
    let idx: number;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      // Each frame can have multiple `data: ...` lines; we only emit one per frame.
      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trimStart());
      if (!dataLines.length) continue;

      const payload = dataLines.join("\n");
      let parsed: unknown;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      const msg = parsed as
        | { type: "event"; event: SectionEvent }
        | { type: "done"; plan: Plan }
        | { type: "error"; message: string };

      if (msg.type === "event") {
        cb.onEvent?.(msg.event);
      } else if (msg.type === "done") {
        plan = msg.plan;
      } else if (msg.type === "error") {
        errorMessage = msg.message;
      }
    }
  }

  if (errorMessage) throw new Error(errorMessage);
  if (!plan) throw new Error("Stream ended without a plan");
  return plan;
}
