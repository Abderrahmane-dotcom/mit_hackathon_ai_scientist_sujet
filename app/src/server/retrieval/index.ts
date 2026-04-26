// Selects the best available retrieval backend at runtime.
// - If TAVILY_API_KEY is set, use the real Tavily client.
// - Otherwise fall back to the mock (keeps offline dev + CI green).

import { mockRetrieval, type RetrievalClient } from "./mock";
import { createTavilyRetrieval } from "./tavily";

export function pickRetrieval(): RetrievalClient {
  const tavily = createTavilyRetrieval();
  if (tavily) {
    // eslint-disable-next-line no-console
    console.log("[retrieval] using Tavily (live)");
    return tavily;
  }
  // eslint-disable-next-line no-console
  console.log("[retrieval] using mock (no TAVILY_API_KEY)");
  return mockRetrieval;
}
