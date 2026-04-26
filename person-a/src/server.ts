// Minimal Node HTTP server exposing /api/plan and /api/regenerate as SSE.
// No framework dependency — keeps install fast for the hackathon.

import "./bootstrap.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { orchestrate, type SectionEvent } from "./orchestrator.js";

const PORT = Number(process.env.PORT ?? 8787);

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
