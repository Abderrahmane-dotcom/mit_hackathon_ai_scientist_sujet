// Catalog-number resolvability checker — Person B deliverable #4.
// For each material item, verify the catalog_url is reachable AND the
// returned page mentions the catalog_number. Used by /api/qc and CI.
//
// Designed to be safe to call from a route handler:
//  - HEAD first (cheap), GET fallback for sites that 405 on HEAD
//  - 6s timeout per request
//  - Concurrency cap (4) to be polite to suppliers
//  - Never throws; returns a structured report

import type { Plan } from "../shared/types.js";

export interface CatalogCheck {
  name: string;
  catalog_number: string;
  catalog_url: string;
  ok: boolean;
  status?: number;
  reason?: string;
}

export interface CatalogReport {
  total: number;
  passed: number;
  checks: CatalogCheck[];
}

export interface ValidateOptions {
  timeoutMs?: number;     // default 6000
  concurrency?: number;   // default 4
  contentCheck?: boolean; // default true; GETs body and looks for catalog_number
}

export async function validateCatalog(
  items: Plan["materials"]["items"],
  opts: ValidateOptions = {}
): Promise<CatalogReport> {
  const timeoutMs   = opts.timeoutMs   ?? 6_000;
  const concurrency = opts.concurrency ?? 4;
  const contentCheck = opts.contentCheck ?? true;

  const queue = [...items];
  const checks: CatalogCheck[] = [];

  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const m = queue.shift();
      if (!m) break;
      checks.push(await checkOne(m, timeoutMs, contentCheck));
    }
  });
  await Promise.all(workers);

  // Preserve original order
  const byUrl = new Map(checks.map((c) => [c.catalog_url + "::" + c.catalog_number, c] as const));
  const ordered = items.map(
    (m) =>
      byUrl.get(m.catalog_url + "::" + m.catalog_number) ?? {
        name: m.name,
        catalog_number: m.catalog_number,
        catalog_url: m.catalog_url,
        ok: false,
        reason: "no result",
      }
  );

  return {
    total: items.length,
    passed: ordered.filter((c) => c.ok).length,
    checks: ordered,
  };
}

async function checkOne(
  m: Plan["materials"]["items"][number],
  timeoutMs: number,
  contentCheck: boolean
): Promise<CatalogCheck> {
  const base: Omit<CatalogCheck, "ok"> = {
    name: m.name,
    catalog_number: m.catalog_number,
    catalog_url: m.catalog_url,
  };

  if (!/^https?:\/\//.test(m.catalog_url)) {
    return { ...base, ok: false, reason: "invalid url scheme" };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    // Try HEAD first
    const head = await fetch(m.catalog_url, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "HypothesisHub/0.1 (+catalog validator)" },
    }).catch(() => null);

    // Fallback to GET if HEAD not allowed or content check needed
    const needGet = !head || !head.ok || head.status === 405 || contentCheck;
    const res: Response = needGet
      ? await fetch(m.catalog_url, {
          method: "GET",
          redirect: "follow",
          signal: ctrl.signal,
          headers: { "user-agent": "HypothesisHub/0.1 (+catalog validator)" },
        })
      : head!;

    if (!res.ok) {
      return { ...base, ok: false, status: res.status, reason: `HTTP ${res.status}` };
    }

    if (contentCheck && m.catalog_number.trim()) {
      // Read up to ~256KB; suppliers' product pages are usually well under that
      const buf = await readCapped(res, 256 * 1024);
      const haystack = buf.toLowerCase();
      const needle = m.catalog_number.toLowerCase();
      const found = haystack.includes(needle);
      return {
        ...base,
        ok: found,
        status: res.status,
        reason: found ? undefined : `catalog # "${m.catalog_number}" not found in page body`,
      };
    }

    return { ...base, ok: true, status: res.status };
  } catch (err) {
    return { ...base, ok: false, reason: (err as Error).message.slice(0, 120) };
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return await res.text();
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  try { await reader.cancel(); } catch { /* ignore */ }
  return new TextDecoder("utf-8", { fatal: false }).decode(concat(chunks));
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}
