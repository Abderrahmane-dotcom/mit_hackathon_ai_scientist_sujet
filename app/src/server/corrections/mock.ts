// Mock corrections store — Person C will replace with the real pgvector-backed module.

export interface Correction {
  experiment_type: string;
  section: "protocol" | "materials" | "budget" | "timeline" | "validation" | "overview";
  before: string;
  after: string;
  rationale: string;
}

export interface CorrectionsClient {
  topK(args: { experiment_type: string; section: Correction["section"]; k?: number }): Promise<Correction[]>;
}

// In-memory seed so the stretch-goal demo (regenerate with applied correction) works
// without Person C's pgvector being live.
const seed: Correction[] = [
  {
    experiment_type: "cell-cryopreservation",
    section: "materials",
    before: "trehalose at 5% w/v",
    after: "trehalose at 10% w/v",
    rationale:
      "Membrane stabilization plateaus near 10% w/v in HeLa cryopreservation; 5% under-protects against ice nucleation.",
  },
  {
    experiment_type: "perovskite-tandem-fab",
    section: "protocol",
    before: "anneal at 100°C for 10 min",
    after: "two-step anneal: 100°C for 5 min then 150°C for 10 min in N2",
    rationale:
      "Two-step anneal in inert atmosphere increases grain size and reduces defect density at the SAM interface.",
  },
];

export const mockCorrections: CorrectionsClient = {
  async topK({ experiment_type, section, k = 3 }) {
    return seed
      .filter((c) => c.experiment_type === experiment_type && c.section === section)
      .slice(0, k);
  },
};
