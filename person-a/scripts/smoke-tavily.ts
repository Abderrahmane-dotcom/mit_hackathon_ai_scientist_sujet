// Tiny manual smoke for the Tavily client. Prints results, doesn't run agents.
// Uses ~3 credits (one call per profile). Run: npx tsx scripts/smoke-tavily.ts
import "../src/bootstrap.js";
import { createTavilyRetrieval } from "../src/retrieval/tavily.js";

const client = createTavilyRetrieval();
if (!client) {
  console.error("TAVILY_API_KEY missing in .env");
  process.exit(1);
}

const q = process.argv[2] ?? "trehalose cryopreservation HeLa cells protocol";

const [protocols, suppliers, papers] = await Promise.all([
  client.protocols(q),
  client.suppliers("trehalose dihydrate"),
  client.papers(q),
]);

console.log("\n=== protocols ===");
protocols.forEach((r) => console.log(` - ${r.source}: ${r.url}`));
console.log("\n=== suppliers ===");
suppliers.forEach((r) => console.log(` - ${r.source}: ${r.url}`));
console.log("\n=== papers ===");
papers.forEach((r) => console.log(` - ${r.source}: ${r.url}`));
console.log(`\ntotals: protocols=${protocols.length} suppliers=${suppliers.length} papers=${papers.length}`);
