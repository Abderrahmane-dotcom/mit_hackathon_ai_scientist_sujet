// Deterministic stub generator so eval and demos work without an API key.
// Returns schema-valid section JSON keyed by agent name. Generic enough to
// pass schema validation for any hypothesis.

export function stubFor(agentKey: string, user: string): unknown {
  // a stable-ish hash tag derived from hypothesis to make plans look different
  const tag = simpleHash(user).toString(36).slice(0, 4);

  switch (agentKey) {
    case "overview":
      return {
        primary_goal:
          `Determine whether the proposed intervention produces the predicted, measurable effect under controlled conditions (case ${tag}).`,
        validation_approach:
          "Two-arm controlled study comparing intervention vs. baseline. Replicates per arm: n ≥ 6. Outcome read-outs are pre-registered before unblinding.",
        success_criteria: [
          "Primary endpoint meets the threshold stated in the hypothesis (p < 0.05).",
          "Effect is reproducible across two independent batches (σ across batches < 10% of mean).",
          "No critical safety/quality flags raised during QC.",
        ],
      };

    case "protocol":
      return {
        steps: [
          {
            n: 1,
            title: "Materials prep & QC",
            description:
              "Receive reagents, verify lot numbers and CoA. Aliquot temperature-sensitive items. Prepare working stocks at concentrations specified in step 3.",
            duration_hours: 4,
            citations: [{ url: "https://www.protocols.io/", label: "protocols.io general SOP" }],
          },
          {
            n: 2,
            title: "Baseline arm setup",
            description:
              "Set up control samples following the standard published protocol. Record environmental conditions (temperature, humidity, time-of-day).",
            duration_hours: 6,
            citations: [{ url: "https://www.bio-protocol.org/", label: "bio-protocol baseline" }],
          },
          {
            n: 3,
            title: "Intervention arm",
            description:
              "Apply the intervention specified in the hypothesis. Maintain matched conditions to the baseline arm except for the variable under test.",
            duration_hours: 8,
            citations: [{ url: "https://www.nature.com/nprot/", label: "Nature Protocols reference" }],
          },
          {
            n: 4,
            title: "Read-out & data capture",
            description:
              "Measure primary endpoint with the validation method. Capture raw instrument output, store with sample IDs and timestamps.",
            duration_hours: 5,
            citations: [{ url: "https://www.protocols.io/", label: "read-out SOP" }],
          },
          {
            n: 5,
            title: "Statistics & reporting",
            description:
              "Run the pre-registered statistical test. Generate figures, fill the template report, archive raw data.",
            duration_hours: 6,
            citations: [{ url: "https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2737408/", label: "MIQE-style QC" }],
          },
        ],
      };

    case "materials":
      return {
        items: [
          {
            name: "Primary reagent (intervention)",
            catalog_number: "Sigma-203033",
            supplier: "Sigma-Aldrich",
            catalog_url: "https://www.sigmaaldrich.com/US/en/product/sigald/203033",
            qty: "5 g",
            unit_cost_usd: 312,
            total_cost_usd: 312,
            notes: "Ship cold; store per CoA.",
          },
          {
            name: "Control reagent",
            catalog_number: "TCI-L0279",
            supplier: "TCI Chemicals",
            catalog_url: "https://www.tcichemicals.com/US/en/p/L0279",
            qty: "10 g",
            unit_cost_usd: 287,
            total_cost_usd: 287,
          },
          {
            name: "Assay/instrument consumables",
            catalog_number: "Thermo-12345",
            supplier: "Thermo Fisher",
            catalog_url: "https://www.thermofisher.com/order/catalog/product/12345",
            qty: "1 kit",
            unit_cost_usd: 410,
            total_cost_usd: 410,
          },
          {
            name: "Buffer / matrix",
            catalog_number: "AlfaA-12886",
            supplier: "Alfa Aesar",
            catalog_url: "https://www.alfa.com/en/catalog/12886/",
            qty: "25 g",
            unit_cost_usd: 96,
            total_cost_usd: 96,
          },
        ],
        total_usd: 312 + 287 + 410 + 96,
      };

    case "budget": {
      const reagents = 1105; // matches stub materials total
      const consumables = 600;
      const equipment = 800;
      const labor = 4200;
      const overhead = Math.round((reagents + consumables + equipment + labor) * 0.15);
      const total = reagents + consumables + equipment + labor + overhead;
      const cite = (url: string, title: string) => [{ url, title }];
      return {
        lines: [
          { category: "reagents",    description: "Reagents per materials list",          cost_usd: reagents,    citations: cite("https://www.sigmaaldrich.com/", "Sigma-Aldrich catalog") },
          { category: "consumables", description: "Tips, plates, tubes, gloves",          cost_usd: consumables, citations: cite("https://www.thermofisher.com/", "Thermo Fisher catalog") },
          { category: "equipment",   description: "Instrument time (shared facility)",    cost_usd: equipment,   citations: cite("https://orip.nih.gov/", "NIH shared-instrument rate guidance") },
          { category: "labor",       description: "Technician + scientist hours",         cost_usd: labor,       citations: cite("https://www.bls.gov/oes/current/oes192041.htm", "BLS OES — biological technicians") },
          { category: "overhead",    description: "Institutional overhead (~15%)",        cost_usd: overhead,    citations: cite("https://rates.psc.gov/", "DHHS negotiated F&A rate agreements") },
        ],
        labor_usd: labor,
        overhead_usd: overhead,
        total_usd: total,
      };
    }

    case "timeline":
      return {
        weeks: 10,
        phases: [
          { id: "P1", name: "Materials & prep",     start_week: 0, duration_weeks: 2, depends_on: [] },
          { id: "P2", name: "Baseline arm",         start_week: 2, duration_weeks: 2, depends_on: ["P1"] },
          { id: "P3", name: "Intervention arm",     start_week: 4, duration_weeks: 2, depends_on: ["P2"] },
          { id: "P4", name: "Characterisation",     start_week: 6, duration_weeks: 1, depends_on: ["P3"] },
          { id: "P5", name: "Stability / extended", start_week: 5, duration_weeks: 4, depends_on: ["P3"] },
          { id: "P6", name: "Analysis & report",    start_week: 9, duration_weeks: 1, depends_on: ["P4", "P5"] },
        ],
        critical_path: ["P1", "P2", "P3", "P5", "P6"],
        slack_weeks: 0,
      };

    case "validation":
      return {
        metrics: [
          { name: "Primary endpoint", threshold: "meets hypothesis-stated threshold", method: "instrument-validated assay" },
          { name: "Reproducibility",  threshold: "σ < 10% across two batches",          method: "independent batch repeat" },
        ],
        controls: [
          "Vehicle / negative control matched to intervention conditions",
          "Positive control with known response",
          "Inter-batch calibrator run alongside both arms",
        ],
        statistics:
          "Two-tailed Welch's t-test (n ≥ 6 per arm); pre-registered analysis plan. α = 0.05. Power calc targets 80% to detect the hypothesis-stated effect size.",
      };

    case "novelty":
      return {
        signal: "similar_work_exists",
        refs: [
          {
            title: "Related prior work A",
            url: "https://arxiv.org/abs/0000.00001",
            source: "arxiv",
          },
          {
            title: "Related prior work B",
            url: "https://www.semanticscholar.org/paper/0000",
            source: "semanticscholar",
          },
        ],
      };

    default:
      throw new Error(`stubFor: no stub registered for "${agentKey}"`);
  }
}

function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}
