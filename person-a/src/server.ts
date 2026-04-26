// Minimal Node HTTP server exposing /api/plan and /api/regenerate as SSE.
// No framework dependency — keeps install fast for the hackathon.

import "./bootstrap.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { orchestrate, type SectionEvent } from "./orchestrator.js";
import { pickRetrieval } from "./retrieval/index.js";
import { runNoveltyAgent } from "./agents/novelty.js";
import { validateCatalog } from "./retrieval/validateCatalog.js";
import { classifyHypothesis } from "./retrieval/classify.js";
import { renderPlanMarkdown } from "./export/markdown.js";
import { PlanSchema, type Plan } from "./shared/types.js";

const PORT = Number(process.env.PORT ?? 8787);
const retrieval = pickRetrieval();

function sendJSON(res: ServerResponse, code: number, body: unknown) {
  res.writeHead(code, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(JSON.stringify(body));
}

function sseHeaders(res: ServerResponse) {
  res.writeHead(200, {
    "content-type": "text/event-stream",
    "cache-control": "no-cache, no-transform",
    "connection": "keep-alive",
    "access-control-allow-origin": "*",
    "x-accel-buffering": "no",
  });
}

function sseSend(res: ServerResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8") || "{}";
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && req.url === "/healthz") {
    return sendJSON(res, 200, { ok: true, stub: process.env.STUB_LLM === "1" });
  }

  // Person B — novelty QC endpoint. 1 Tavily call + 1 small LLM call. Used by
  // the UI to gate the "desk reveal": only set the desk if novelty is OK.
  if (req.method === "POST" && req.url === "/api/qc") {
    const body = (await readBody(req)) as { hypothesis?: string };
    if (!body.hypothesis || typeof body.hypothesis !== "string" || body.hypothesis.length < 10) {
      return sendJSON(res, 400, { error: "hypothesis (>=10 chars) is required" });
    }
    try {
      const t0 = Date.now();
      const papers = await retrieval.papers(body.hypothesis);
      const { data, trace } = await runNoveltyAgent({ hypothesis: body.hypothesis, papers });
      return sendJSON(res, 200, {
        ...data,
        latency_ms: Date.now() - t0,
        agent_trace: trace,
      });
    } catch (err) {
      return sendJSON(res, 500, { error: (err as Error).message });
    }
  }

  // Person B — classifier endpoint. Used by Person C to key correction lookups.
  if (req.method === "POST" && req.url === "/api/classify") {
    const body = (await readBody(req)) as { hypothesis?: string };
    if (!body.hypothesis || typeof body.hypothesis !== "string" || body.hypothesis.length < 10) {
      return sendJSON(res, 400, { error: "hypothesis (>=10 chars) is required" });
    }
    try {
      const cls = await classifyHypothesis(body.hypothesis);
      return sendJSON(res, 200, cls);
    } catch (err) {
      return sendJSON(res, 500, { error: (err as Error).message });
    }
  }

  // Person B — catalog resolvability validator. Accepts either a Plan or
  // bare materials.items list. Used in CI and by the UI to mark dead links.
  if (req.method === "POST" && req.url === "/api/validate-catalog") {
    const body = (await readBody(req)) as {
      items?: Array<{ name: string; catalog_number: string; catalog_url: string }>;
      plan?: { materials?: { items?: typeof body.items } };
    };
    const items = body.items ?? body.plan?.materials?.items ?? [];
    if (!Array.isArray(items) || items.length === 0) {
      return sendJSON(res, 400, { error: "items[] or plan.materials.items[] is required" });
    }
    try {
      const report = await validateCatalog(items as Parameters<typeof validateCatalog>[0]);
      return sendJSON(res, 200, report);
    } catch (err) {
      return sendJSON(res, 500, { error: (err as Error).message });
    }
  }

  // Person B — render an existing Plan JSON to a Markdown report.
  // Stateless: caller supplies the Plan (e.g. one received from /api/plan).
  if (req.method === "POST" && req.url === "/api/export/markdown") {
    const body = (await readBody(req)) as { plan?: unknown };
    const parsed = PlanSchema.safeParse((body && (body as { plan?: unknown }).plan) ?? body);
    if (!parsed.success) {
      return sendJSON(res, 400, { error: "valid Plan JSON required", issues: parsed.error.issues });
    }
    const md = renderPlanMarkdown(parsed.data);
    res.writeHead(200, {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="plan-${parsed.data.id}.md"`,
      "access-control-allow-origin": "*",
    });
    res.end(md);
    return;
  }

  // Person B — full pipeline that returns Markdown directly. Convenient for
  // CLI / curl / "download report" buttons. Internally runs orchestrate()
  // without SSE and renders the resulting Plan.
  if (req.method === "POST" && req.url === "/api/plan.md") {
    const body = (await readBody(req)) as { hypothesis?: string; experiment_type?: string };
    if (!body.hypothesis || typeof body.hypothesis !== "string" || body.hypothesis.length < 10) {
      return sendJSON(res, 400, { error: "hypothesis (>=10 chars) is required" });
    }
    try {
      const plan: Plan = await orchestrate({
        hypothesis: body.hypothesis,
        experiment_type: body.experiment_type,
        retrieval,
        emit: () => {},
        applyCorrections: false,
      });
      const md = renderPlanMarkdown(plan);
      res.writeHead(200, {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": `attachment; filename="plan-${plan.id}.md"`,
        "access-control-allow-origin": "*",
      });
      res.end(md);
    } catch (err) {
      sendJSON(res, 500, { error: (err as Error).message });
    }
    return;
  }

  if (req.method === "POST" && (req.url === "/api/plan" || req.url === "/api/regenerate")) {
    const body = (await readBody(req)) as { hypothesis?: string; experiment_type?: string };
    if (!body.hypothesis || typeof body.hypothesis !== "string" || body.hypothesis.length < 10) {
      return sendJSON(res, 400, { error: "hypothesis (>=10 chars) is required" });
    }

    sseHeaders(res);
    const apply = req.url === "/api/regenerate";

    const emit = (e: SectionEvent) => {
      switch (e.kind) {
        case "section":
          sseSend(res, "section", { section: e.section, content: e.content, latency_ms: e.latency_ms });
          break;
        case "agent_start":
          sseSend(res, "agent_start", { section: e.section });
          break;
        case "token":
          sseSend(res, "token", { section: e.section, delta: e.delta });
          break;
        case "info":
        case "warning":
          sseSend(res, e.kind, { message: e.message });
          break;
      }
    };

    try {
      const plan = await orchestrate({
        hypothesis: body.hypothesis,
        experiment_type: body.experiment_type,
        retrieval,
        emit,
        applyCorrections: apply,
      });
      sseSend(res, "done", plan);
      res.end();
    } catch (err) {
      sseSend(res, "error", { message: (err as Error).message });
      res.end();
    }
    return;
  }

  sendJSON(res, 404, { error: "not found" });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[person-a] listening on http://localhost:${PORT}  ` +
    `(STUB_LLM=${process.env.STUB_LLM === "1" ? "on" : "off"})`
  );
});
