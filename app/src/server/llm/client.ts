// LLM client: provider-agnostic JSON generation with Zod validation + repair.
// Providers: gemini | openai | stub (toggle via env: LLM_PROVIDER, STUB_LLM=1).

import OpenAI from "openai";
import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { z, ZodTypeAny } from "zod";
import { stubFor } from "./stub";
import { withRateLimit } from "./ratelimit";

type Provider = "groq" | "gemini" | "openai" | "stub";

function resolveProvider(): Provider {
  if (process.env.STUB_LLM === "1") return "stub";
  const p = (process.env.LLM_PROVIDER ?? "groq").toLowerCase();
  if (p === "openai") return "openai";
  if (p === "gemini") return "gemini";
  if (p === "stub")   return "stub";
  return "groq";
}

const PROVIDER = resolveProvider();
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.2";
const GROQ_MODEL   = process.env.GROQ_MODEL   ?? "llama-3.3-70b-versatile";

const openai = PROVIDER === "openai"
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY ?? "" })
  : null;

const groq = PROVIDER === "groq"
  ? new OpenAI({
      apiKey: process.env.GROQ_API_KEY ?? "",
      baseURL: "https://api.groq.com/openai/v1",
    })
  : null;

const gemini = PROVIDER === "gemini"
  ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY ?? "" })
  : null;

export interface GenJSONOptions<T extends ZodTypeAny> {
  agent: string;
  system: string;
  user: string;
  schema: T;
  stubKey?: string;
  temperature?: number;
  onDelta?: (chunk: string) => void; // streamed token chunks (raw)
}

export interface GenJSONResult<T> {
  data: T;
  trace: {
    agent: string;
    model: string;
    latency_ms: number;
    tokens_in?: number;
    tokens_out?: number;
  };
}

export async function generateJSON<T extends ZodTypeAny>(
  opts: GenJSONOptions<T>
): Promise<GenJSONResult<z.infer<T>>> {
  const t0 = Date.now();

  // ── STUB ────────────────────────────────────────────────────────────────
  if (PROVIDER === "stub") {
    const stub = stubFor(opts.stubKey ?? opts.agent, opts.user);
    const parsed = opts.schema.safeParse(stub);
    if (!parsed.success) {
      throw new Error(`[stub:${opts.agent}] schema mismatch: ${parsed.error.message}`);
    }
    return {
      data: parsed.data,
      trace: { agent: opts.agent, model: "stub", latency_ms: Date.now() - t0 },
    };
  }

  // ── GROQ (OpenAI-compatible) ────────────────────────────────────────────
  if (PROVIDER === "groq" && groq) {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system + "\n\nRespond with valid JSON only." },
      { role: "user", content: opts.user + "\n\nReturn JSON only, no prose." },
    ];

    const callGroq = async (temp: number, useJsonMode: boolean) =>
      groq!.chat.completions.create({
        model: GROQ_MODEL,
        temperature: temp,
        ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
        messages,
      });

    let first;
    try {
      first = await withRateLimit(`groq:${opts.agent}`, () =>
        callGroq(opts.temperature ?? 0.2, true)
      );
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      // Groq returns 400 "Failed to generate JSON" sporadically; retry once without json mode.
      if (msg.includes("Failed to generate JSON") || e?.status === 400) {
        first = await withRateLimit(`groq:${opts.agent}:retry`, () =>
          callGroq(0, false)
        );
      } else {
        throw e;
      }
    }
    const raw = first.choices[0]?.message?.content ?? "{}";
    let json = safeJSON(raw);
    let parsed = opts.schema.safeParse(json);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const repairMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        ...messages,
        { role: "assistant", content: raw },
        {
          role: "user",
          content:
            "Your previous JSON failed validation:\n" +
            issues.map((i) => `- /${i.path.join("/")}: ${i.message}`).join("\n") +
            "\nReturn corrected JSON only.",
        },
      ];
      const callRepair = async (useJsonMode: boolean) =>
        groq!.chat.completions.create({
          model: GROQ_MODEL,
          temperature: 0,
          ...(useJsonMode ? { response_format: { type: "json_object" as const } } : {}),
          messages: repairMessages,
        });
      let repair;
      try {
        repair = await withRateLimit(`groq:${opts.agent}:repair`, () => callRepair(true));
      } catch (e: any) {
        const msg = String(e?.message ?? e);
        if (msg.includes("Failed to generate JSON") || e?.status === 400) {
          repair = await withRateLimit(`groq:${opts.agent}:repair2`, () => callRepair(false));
        } else {
          throw e;
        }
      }
      json = safeJSON(repair.choices[0]?.message?.content ?? "{}");
      parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`[${opts.agent}] groq schema validation failed after repair: ${parsed.error.message}`);
      }
    }

    return {
      data: parsed.data,
      trace: {
        agent: opts.agent,
        model: GROQ_MODEL,
        latency_ms: Date.now() - t0,
        tokens_in: first.usage?.prompt_tokens,
        tokens_out: first.usage?.completion_tokens,
      },
    };
  }

  // ── GEMINI ──────────────────────────────────────────────────────────────
  if (PROVIDER === "gemini" && gemini) {
    const responseSchema = zodToGeminiSchema(opts.schema);
    const cfg: Record<string, unknown> = {
      systemInstruction: opts.system,
      temperature: opts.temperature ?? 0.2,
      responseMimeType: "application/json",
    };
    if (responseSchema) cfg.responseSchema = responseSchema;

    const first = await withRateLimit(`gemini:${opts.agent}`, () =>
      gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: opts.user,
        config: cfg,
      })
    );
    const raw = first.text ?? "{}";
    let json = safeJSON(raw);
    let parsed = opts.schema.safeParse(json);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const repair = await withRateLimit(`gemini:${opts.agent}:repair`, () =>
        gemini.models.generateContent({
          model: GEMINI_MODEL,
          contents:
            opts.user +
            "\n\nYour previous JSON failed validation:\n" +
            issues.map((i) => `- /${i.path.join("/")}: ${i.message}`).join("\n") +
            "\nReturn corrected JSON only.",
          config: { ...cfg, temperature: 0 },
        })
      );
      json = safeJSON(repair.text ?? "{}");
      parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`[${opts.agent}] gemini schema validation failed after repair: ${parsed.error.message}`);
      }
    }

    return {
      data: parsed.data,
      trace: {
        agent: opts.agent,
        model: GEMINI_MODEL,
        latency_ms: Date.now() - t0,
        tokens_in: first.usageMetadata?.promptTokenCount,
        tokens_out: first.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  // ── OPENAI ──────────────────────────────────────────────────────────────
  if (PROVIDER === "openai" && openai) {
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: opts.system },
      { role: "user", content: opts.user },
    ];

    // gpt-5 / o-series only allow the default temperature (1).
    const supportsCustomTemp = !/^(gpt-5|o\d)/i.test(OPENAI_MODEL);

    let raw: string;
    let usageIn: number | undefined;
    let usageOut: number | undefined;

    if (opts.onDelta) {
      // Streaming path: emit token chunks as they arrive.
      const stream = await withRateLimit(`openai:${opts.agent}`, () =>
        openai.chat.completions.create({
          model: OPENAI_MODEL,
          ...(supportsCustomTemp ? { temperature: opts.temperature ?? 0.2 } : {}),
          response_format: { type: "json_object" },
          messages,
          stream: true,
          stream_options: { include_usage: true },
        })
      );
      const parts: string[] = [];
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content ?? "";
        if (delta) {
          parts.push(delta);
          try { opts.onDelta(delta); } catch { /* swallow sink errors */ }
        }
        if (chunk.usage) {
          usageIn = chunk.usage.prompt_tokens;
          usageOut = chunk.usage.completion_tokens;
        }
      }
      raw = parts.join("") || "{}";
    } else {
      const first = await withRateLimit(`openai:${opts.agent}`, () =>
        openai.chat.completions.create({
          model: OPENAI_MODEL,
          ...(supportsCustomTemp ? { temperature: opts.temperature ?? 0.2 } : {}),
          response_format: { type: "json_object" },
          messages,
        })
      );
      raw = first.choices[0]?.message?.content ?? "{}";
      usageIn = first.usage?.prompt_tokens;
      usageOut = first.usage?.completion_tokens;
    }

    let json = safeJSON(raw);
    let parsed = opts.schema.safeParse(json);

    if (!parsed.success) {
      const issues = parsed.error.issues;
      const repair = await withRateLimit(`openai:${opts.agent}:repair`, () =>
        openai.chat.completions.create({
          model: OPENAI_MODEL,
          ...(supportsCustomTemp ? { temperature: 0 } : {}),
          response_format: { type: "json_object" },
          messages: [
            ...messages,
            { role: "assistant", content: raw },
            {
              role: "user",
              content:
                "Your previous JSON failed validation:\n" +
                issues.map((i) => `- /${i.path.join("/")}: ${i.message}`).join("\n") +
                "\nReturn corrected JSON only.",
            },
          ],
        })
      );
      json = safeJSON(repair.choices[0]?.message?.content ?? "{}");
      parsed = opts.schema.safeParse(json);
      if (!parsed.success) {
        throw new Error(`[${opts.agent}] openai schema validation failed after repair: ${parsed.error.message}`);
      }
    }

    return {
      data: parsed.data,
      trace: {
        agent: opts.agent,
        model: OPENAI_MODEL,
        latency_ms: Date.now() - t0,
        tokens_in: usageIn,
        tokens_out: usageOut,
      },
    };
  }

  throw new Error(`LLM provider not configured: ${PROVIDER}`);
}

function safeJSON(s: string): unknown {
  try { return JSON.parse(s); } catch { /* fall through to substring extraction */ }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { /* fall through */ }
  }
  return {};
}

// ── Zod → Gemini Schema (best-effort, covers what we use) ─────────────────
function zodToGeminiSchema(s: ZodTypeAny): Schema | undefined {
  try {
    return convert(s);
  } catch {
    return undefined;
  }
}

function convert(s: ZodTypeAny): Schema {
  const def: any = (s as any)._def;
  const t = def?.typeName as string;

  switch (t) {
    case "ZodString":
      return { type: Type.STRING };
    case "ZodNumber":
      return { type: Type.NUMBER };
    case "ZodBoolean":
      return { type: Type.BOOLEAN };
    case "ZodEnum":
      return { type: Type.STRING, enum: def.values };
    case "ZodLiteral":
      return { type: Type.STRING, enum: [String(def.value)] };
    case "ZodArray":
      return { type: Type.ARRAY, items: convert(def.type) };
    case "ZodObject": {
      const shape = def.shape();
      const properties: Record<string, Schema> = {};
      const required: string[] = [];
      for (const [k, v] of Object.entries(shape)) {
        const inner = v as ZodTypeAny;
        const innerDef: any = (inner as any)._def;
        const isOptional = innerDef.typeName === "ZodOptional" || innerDef.typeName === "ZodDefault";
        const target = isOptional ? innerDef.innerType : inner;
        properties[k] = convert(target);
        if (!isOptional) required.push(k);
      }
      return { type: Type.OBJECT, properties, required };
    }
    case "ZodOptional":
    case "ZodDefault":
      return convert(def.innerType);
    case "ZodUnion":
      return convert(def.options[0]);
    case "ZodEffects":
      return convert(def.schema);
    default:
      return { type: Type.STRING };
  }
}
