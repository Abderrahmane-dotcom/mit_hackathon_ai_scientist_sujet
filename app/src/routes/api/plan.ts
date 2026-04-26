// SSE streaming endpoint: POST /api/plan
// Body: { hypothesis: string }
// Streams Server-Sent Events with { type: "event", event: SectionEvent }
// then finally { type: "done", plan: Plan } or { type: "error", message: string }.

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { orchestrate, type SectionEvent } from "@/server/orchestrator";
import { pickRetrieval } from "@/server/retrieval";

const Body = z.object({
  hypothesis: z.string().min(10).max(2000),
});

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/plan")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: CORS_HEADERS }),

      POST: async ({ request }) => {
        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch (e) {
          return new Response(
            JSON.stringify({ error: e instanceof Error ? e.message : "invalid body" }),
            {
              status: 400,
              headers: { "Content-Type": "application/json", ...CORS_HEADERS },
            },
          );
        }

        const stream = new ReadableStream({
          async start(controller) {
            const enc = new TextEncoder();
            const send = (obj: unknown) => {
              try {
                controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
              } catch {
                // controller closed (client disconnect) — ignore
              }
            };

            const emit = (e: SectionEvent) => send({ type: "event", event: e });

            try {
              const plan = await orchestrate({
                hypothesis: body.hypothesis,
                retrieval: pickRetrieval(),
                emit,
              });
              send({ type: "done", plan });
            } catch (err) {
              const message = err instanceof Error ? err.message : String(err);
              console.error("[/api/plan] orchestrate failed:", message);
              send({ type: "error", message });
            } finally {
              try {
                controller.close();
              } catch {
                // already closed
              }
            }
          },
        });

        return new Response(stream, {
          status: 200,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            ...CORS_HEADERS,
          },
        });
      },
    },
  },
});
