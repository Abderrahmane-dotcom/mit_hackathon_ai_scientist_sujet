// Global rate-limit + retry helper for LLM calls.
// Env knobs: LLM_CONCURRENCY (default 3), LLM_MIN_INTERVAL_MS (default 0), LLM_MAX_RETRIES (default 5).

const CONCURRENCY     = Math.max(1, Number(process.env.LLM_CONCURRENCY     ?? "3"));
const MIN_INTERVAL_MS = Math.max(0, Number(process.env.LLM_MIN_INTERVAL_MS ?? "0"));
const MAX_RETRIES     = Math.max(0, Number(process.env.LLM_MAX_RETRIES     ?? "5"));

let inFlight = 0;
let lastStartedAt = 0;
const queue: Array<() => void> = [];

export function withRateLimit<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = async () => {
      inFlight++;
      try {
        const wait = Math.max(0, lastStartedAt + MIN_INTERVAL_MS - Date.now());
        if (wait > 0) await sleep(wait);
        lastStartedAt = Date.now();
        const result = await runWithRetry(label, fn);
        resolve(result);
      } catch (err) {
        reject(err);
      } finally {
        inFlight--;
        const next = queue.shift();
        if (next) next();
      }
    };
    if (inFlight < CONCURRENCY) start();
    else queue.push(start);
  });
}

async function runWithRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (err) {
      const e = err as Error & { status?: number };
      const msg = e.message ?? String(err);
      const is429 =
        e.status === 429 ||
        /\b429\b/.test(msg) ||
        /RESOURCE_EXHAUSTED/i.test(msg) ||
        /rate.?limit/i.test(msg) ||
        /Too Many Requests/i.test(msg);
      if (!is429 || attempt >= MAX_RETRIES) throw err;
      const delay = parseRetryDelay(msg) ?? Math.min(60_000, 2 ** attempt * 5000);
      attempt++;
      console.warn(`[ratelimit] ${label} hit 429 — retry ${attempt}/${MAX_RETRIES} in ${Math.round(delay / 1000)}s`);
      await sleep(delay);
    }
  }
}

function parseRetryDelay(msg: string): number | null {
  const m1 = msg.match(/retry in (\d+(?:\.\d+)?)s/i);
  if (m1) return Math.ceil(parseFloat(m1[1]!) * 1000) + 1000;
  const m2 = msg.match(/"retryDelay"\s*:\s*"(\d+)s"/);
  if (m2) return parseInt(m2[1]!, 10) * 1000 + 1000;
  const m3 = msg.match(/try again in (\d+(?:\.\d+)?)s/i);
  if (m3) return Math.ceil(parseFloat(m3[1]!) * 1000) + 1000;
  return null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
