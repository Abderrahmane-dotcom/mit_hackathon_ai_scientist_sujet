// Real Tavily-backed RetrievalClient — Person B.
// Implements the same RetrievalClient contract as ./mock.ts so the orchestrator
// can swap it in via dependency injection. Zero-dep (uses native fetch).
//
// Credit budget (1000 total on dev key):
//  - search_depth: "basic"  (1 credit/call)
//  - max_results:  3
//  - 3 calls per plan (protocols, suppliers, papers)  => ~333 plans worst case
//  - Aggressive in-memory sha256 cache: identical hypothesis = 0 extra credits
//
// classify() stays heuristic (free) — same logic as the mock. Upgrading to an
// LLM classifier is a separate Person B P1 item.

import { createHash } from "node:crypto";
import type { RetrievalClient, RetrievalResult } from "./mock";
import { PROFILES } from "./profiles";

const TAVILY_URL = "https://api.tavily.com/search";

interface TavilyResult {
  title: string;
  url: string;
  content?: string;
  score?: number;
}

interface TavilyResponse {
  results?: TavilyResult[];
  answer?: string;
}

interface CacheEntry {
  ts: number;
  results: RetrievalResult[];
}

export interface TavilyOptions {
  apiKey?: string;                  // defaults to process.env.TAVILY_API_KEY
  maxResults?: number;              // default 3
  searchDepth?: "basic" | "advanced"; // default "basic"
  cacheTtlMs?: number;              // default 24h
  timeoutMs?: number;               // default 12s
}

/**
 * Build a Tavily-backed RetrievalClient. Returns null if no API key is present
 * so callers can fall back to the mock.
 */
export function createTavilyRetrieval(opts: TavilyOptions = {}): RetrievalClient | null {
  const apiKey = opts.apiKey ?? process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const maxResults  = opts.maxResults  ?? 3;
  const searchDepth = opts.searchDepth ?? "basic";
  const cacheTtlMs  = opts.cacheTtlMs  ?? 24 * 60 * 60 * 1000;
  const timeoutMs   = opts.timeoutMs   ?? 12_000;

  const cache = new Map<string, CacheEntry>();

  async function search(
    profile: keyof typeof PROFILES,
    query: string
  ): Promise<RetrievalResult[]> {
    const include = PROFILES[profile];
    const key = sha256(`${profile}::${searchDepth}::${maxResults}::${query.trim().toLowerCase()}`);

    const cached = cache.get(key);
    if (cached && Date.now() - cached.ts < cacheTtlMs) return cached.results;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    let json: TavilyResponse;
    try {
      const res = await fetch(TAVILY_URL, {
        method: "POST",
        signal: ctrl.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: searchDepth,
          max_results: maxResults,
          include_domains: include,
          include_answer: false,
        }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`tavily ${res.status}: ${txt.slice(0, 200)}`);
      }
      json = (await res.json()) as TavilyResponse;
    } catch (err) {
      // Soft-fail: never block plan generation on retrieval. Return [].
      // eslint-disable-next-line no-console
      console.warn(`[tavily:${profile}] ${(err as Error).message}`);
      return [];
    } finally {
      clearTimeout(timer);
    }

    const results: RetrievalResult[] = (json.results ?? []).map((r) => ({
      title: r.title || r.url,
      url: r.url,
      source: hostnameOf(r.url),
      snippet: r.content?.slice(0, 280),
    }));

    cache.set(key, { ts: Date.now(), results });
    return results;
  }

  return {
    protocols: (q) => search("protocols", q),
    suppliers: (q) => search("suppliers", q),
    papers:    (q) => search("papers",    q),

    // Heuristic classify — free, deterministic, same as mock.
    async classify(h) {
      const t = h.toLowerCase();
      if (t.includes("perovskite") || t.includes("solar") || t.includes("co2") || t.includes("cathode"))
        return { domain: "materials_climate", experiment_type: inferType(t) };
      if (t.includes("crp") || t.includes("biosensor") || t.includes("elisa"))
        return { domain: "diagnostics", experiment_type: "paper-electrochemical-biosensor" };
      if (t.includes("mice") || t.includes("lactobacillus") || t.includes("intestinal"))
        return { domain: "gut_microbiome", experiment_type: "rodent-probiotic-supplementation" };
      if (t.includes("hela") || t.includes("trehalose") || t.includes("cryo"))
        return { domain: "cell_biology", experiment_type: "cell-cryopreservation" };
      return { domain: "general", experiment_type: "controlled-comparison" };
    },
  };
}

function inferType(t: string): string {
  if (t.includes("perovskite")) return "perovskite-tandem-fab";
  if (t.includes("co2") || t.includes("cathode")) return "bioelectrochemical-co2-fixation";
  return "materials-fabrication";
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
