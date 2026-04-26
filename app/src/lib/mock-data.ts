export type NoveltySignal = "similar" | "novel" | "partial";

export type PaperRef = {
  title: string;
  authors: string;
  venue: string;
  year: number;
  doi: string;
  similarity: number;
};

export type ProtocolStep = {
  id: string;
  phase: string;
  title: string;
  detail: string;
  duration: string;
};

export type TimelinePhase = {
  id: string;
  name: string;
  startWeek: number;
  weeks: number;
  color: string;
  dependsOn?: string;
};

export type Reagent = {
  name: string;
  catalog: string;
  supplier: string;
  qty: string;
  cost: number;
};

export type Plan = {
  novelty: NoveltySignal;
  papers: PaperRef[];
  overview: {
    goal: string;
    approach: string;
    successCriteria: string[];
  };
  protocol: ProtocolStep[];
  timeline: TimelinePhase[];
  reagents: Reagent[];
};

export const MOCK_PLAN: Plan = {
  novelty: "similar",
  papers: [
    {
      title:
        "Perovskite–silicon tandem solar cells exceeding 30% efficiency through interface engineering",
      authors: "Chen, L. et al.",
      venue: "Nature Energy",
      year: 2023,
      doi: "10.1038/s41560-023-01234-5",
      similarity: 0.87,
    },
    {
      title: "Stability mechanisms in formamidinium-based perovskite absorbers",
      authors: "Okafor, A.; Yamamoto, K.",
      venue: "Joule",
      year: 2024,
      doi: "10.1016/j.joule.2024.04.011",
      similarity: 0.71,
    },
    {
      title: "A scalable slot-die coating route to wide-bandgap perovskites",
      authors: "Petrova, E. et al.",
      venue: "Science Advances",
      year: 2022,
      doi: "10.1126/sciadv.abm9087",
      similarity: 0.63,
    },
  ],
  overview: {
    goal: "Determine whether a Cs₀.₁₇FA₀.₈₃PbI₃ perovskite top cell paired with a textured silicon bottom cell can lift tandem PCE from 28.4% (baseline) to ≥31% under AM1.5G.",
    approach:
      "Two-arm fabrication study: (A) baseline tandem reproduction, (B) interface-engineered variant with a self-assembled monolayer (2PACz) and an LiF tunneling layer. Devices are characterized with J–V, EQE, and 1000-hour MPP tracking under ISOS-L-2 conditions.",
    successCriteria: [
      "≥2.5% absolute PCE improvement vs. baseline (n ≥ 6 devices/arm)",
      "T₈₀ stability of ≥800 h under continuous 1-sun MPP at 65 °C",
      "Reproducibility: σ(PCE) < 0.6% across two independent batches",
    ],
  },
  protocol: [
    {
      id: "s1",
      phase: "Prep",
      title: "Substrate preparation",
      detail:
        "Clean textured Si bottom cells via sequential sonication (acetone, IPA, DI), 10 min each; UV-ozone 15 min immediately before deposition.",
      duration: "Day 1",
    },
    {
      id: "s2",
      phase: "Deposition",
      title: "Self-assembled monolayer (2PACz)",
      detail:
        "Spin-coat 1 mM 2PACz in ethanol at 3000 rpm, 30 s. Anneal 100 °C / 10 min in N₂ glovebox (<1 ppm O₂).",
      duration: "Day 1–2",
    },
    {
      id: "s3",
      phase: "Deposition",
      title: "Perovskite absorber",
      detail:
        "Two-step antisolvent: 1.5 M Cs₀.₁₇FA₀.₈₃PbI₃ in DMF:DMSO (4:1), 4000 rpm 30 s, chlorobenzene drip at 10 s. Anneal 100 °C / 30 min.",
      duration: "Day 2–4",
    },
    {
      id: "s4",
      phase: "Deposition",
      title: "Electron transport + LiF tunneling layer",
      detail:
        "Thermal evap C₆₀ (20 nm) → LiF (1 nm) → Cu (100 nm). Base pressure < 5×10⁻⁶ mbar.",
      duration: "Day 4–5",
    },
    {
      id: "s5",
      phase: "Characterization",
      title: "J–V and EQE measurement",
      detail:
        "Class AAA solar simulator, AM1.5G, 100 mW/cm², calibrated KG5 reference cell. 6 devices per arm, both scan directions at 50 mV/s.",
      duration: "Week 5",
    },
    {
      id: "s6",
      phase: "Stability",
      title: "ISOS-L-2 MPP tracking (1000 h)",
      detail:
        "Encapsulated devices under continuous 1-sun illumination, 65 °C, ambient RH. Log Pₘₚₚ every 60 s.",
      duration: "Week 6–10",
    },
    {
      id: "s7",
      phase: "Analysis",
      title: "Statistical comparison",
      detail:
        "Welch's t-test on PCE distributions; Kaplan–Meier on T₈₀. Pre-register threshold: p < 0.01.",
      duration: "Week 10",
    },
  ],
  timeline: [
    { id: "p1", name: "Substrate & SAM prep", startWeek: 1, weeks: 2, color: "signal-cyan" },
    { id: "p2", name: "Perovskite optimization", startWeek: 2, weeks: 3, color: "signal-violet", dependsOn: "p1" },
    { id: "p3", name: "Device fabrication", startWeek: 4, weeks: 2, color: "signal-mint", dependsOn: "p2" },
    { id: "p4", name: "J–V / EQE characterization", startWeek: 5, weeks: 1, color: "signal-amber", dependsOn: "p3" },
    { id: "p5", name: "Stability tracking (ISOS-L-2)", startWeek: 6, weeks: 5, color: "signal-rose", dependsOn: "p4" },
    { id: "p6", name: "Analysis & report", startWeek: 9, weeks: 2, color: "signal-cyan", dependsOn: "p5" },
  ],
  reagents: [
    { name: "2PACz (≥98%)", catalog: "TCI-P2406", supplier: "TCI Chemicals", qty: "100 mg", cost: 245 },
    { name: "Formamidinium iodide (FAI)", catalog: "GreatCellSolar-FAI", supplier: "Greatcell Solar", qty: "5 g", cost: 180 },
    { name: "Cesium iodide (CsI, 99.999%)", catalog: "Sigma-203033", supplier: "Sigma-Aldrich", qty: "5 g", cost: 312 },
    { name: "Lead iodide (PbI₂, 99.999%)", catalog: "TCI-L0279", supplier: "TCI Chemicals", qty: "10 g", cost: 287 },
    { name: "C₆₀ fullerene (sublimed)", catalog: "Sigma-572500", supplier: "Sigma-Aldrich", qty: "1 g", cost: 410 },
    { name: "Lithium fluoride (LiF)", catalog: "AlfaA-12886", supplier: "Alfa Aesar", qty: "25 g", cost: 96 },
    { name: "Anhydrous DMF", catalog: "Sigma-227056", supplier: "Sigma-Aldrich", qty: "1 L", cost: 142 },
    { name: "Anhydrous chlorobenzene", catalog: "Sigma-284513", supplier: "Sigma-Aldrich", qty: "1 L", cost: 118 },
    { name: "Textured Si bottom cells", catalog: "Custom-Si-TX-156", supplier: "Fraunhofer ISE", qty: "20 pcs", cost: 1850 },
    { name: "Encapsulation kit (glass + butyl)", catalog: "Ossila-E261", supplier: "Ossila", qty: "1 kit", cost: 320 },
  ],
};
