// Mock retrieval — Person B will replace with the real Tavily-backed module.
// Agents call these via dependency injection; signatures are the contract.

export interface RetrievalResult {
  title: string;
  url: string;
  source: string;
  snippet?: string;
}

export interface RetrievalClient {
  protocols(query: string): Promise<RetrievalResult[]>;
  suppliers(query: string): Promise<RetrievalResult[]>;
  papers(query: string): Promise<RetrievalResult[]>;
  classify(hypothesis: string): Promise<{ domain: string; experiment_type: string }>;
}

export const mockRetrieval: RetrievalClient = {
  async protocols(q) {
    return [
      { title: `protocols.io result for "${q.slice(0, 40)}"`, url: "https://www.protocols.io/view/example", source: "protocols.io" },
      { title: "Bio-protocol matched method",                  url: "https://bio-protocol.org/e0000",       source: "bio-protocol" },
    ];
  },
  async suppliers(q) {
    return [
      { title: `Sigma-Aldrich match: ${q.slice(0, 40)}`, url: "https://www.sigmaaldrich.com/US/en/product/sigald/203033", source: "sigma" },
      { title: "Thermo Fisher kit",                       url: "https://www.thermofisher.com/order/catalog/product/12345", source: "thermo" },
      { title: "TCI Chemicals fine chem",                 url: "https://www.tcichemicals.com/US/en/p/L0279",                source: "tci" },
    ];
  },
  async papers(q) {
    return [
      { title: `arXiv: ${q.slice(0, 40)}`, url: "https://arxiv.org/abs/0000.00001",                source: "arxiv" },
      { title: "Semantic Scholar paper",   url: "https://www.semanticscholar.org/paper/0000",      source: "semanticscholar" },
    ];
  },
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

function inferType(t: string): string {
  if (t.includes("perovskite")) return "perovskite-tandem-fab";
  if (t.includes("co2") || t.includes("cathode")) return "bioelectrochemical-co2-fixation";
  return "materials-fabrication";
}
