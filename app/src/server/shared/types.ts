// Shared Plan JSON schema — single source of truth across A/B/C and Lovable UI.
// Keep this file dependency-free except Zod so it can be copied into other workspaces.

import { z } from "zod";

export const Reference = z.object({
  title: z.string(),
  url: z.string().url(),
  source: z.string().optional(), // e.g. "protocols.io", "arxiv"
});
export type Reference = z.infer<typeof Reference>;

export const Citation = z.object({
  url: z.string().url(),
  label: z.string().optional(),
});
export type Citation = z.infer<typeof Citation>;

export const ProtocolStep = z.object({
  n: z.number().int().positive(),
  title: z.string().min(3),
  description: z.string().min(10),
  duration_hours: z.number().nonnegative(),
  citations: z.array(Citation).min(1),
});
export type ProtocolStep = z.infer<typeof ProtocolStep>;

export const Reagent = z.object({
  name: z.string(),
  catalog_number: z.string(),
  supplier: z.string(),
  catalog_url: z.string().url(),
  qty: z.preprocess(
    (v) => (typeof v === "number" ? String(v) : v),
    z.string()
  ),                               // human, e.g. "100 mg" (coerced from number if model returns one)
  unit_cost_usd: z.number().nonnegative(),
  total_cost_usd: z.number().nonnegative(),
  notes: z.string().optional(),
});
export type Reagent = z.infer<typeof Reagent>;

export const BudgetLine = z.object({
  category: z.enum(["reagents", "consumables", "equipment", "labor", "overhead", "other"]),
  description: z.string(),
  cost_usd: z.number().nonnegative(),
  citations: z.array(Citation).min(1),
});
export type BudgetLine = z.infer<typeof BudgetLine>;

export const TimelinePhase = z.object({
  id: z.string(),                  // "P1"
  name: z.string(),
  start_week: z.number().int().nonnegative(),
  duration_weeks: z.number().int().positive(),
  depends_on: z.array(z.string()).default([]),
});
export type TimelinePhase = z.infer<typeof TimelinePhase>;

export const Metric = z.object({
  name: z.string(),
  threshold: z.string(),           // "≥31% PCE"
  method: z.string(),              // "J-V under AM1.5G"
});
export type Metric = z.infer<typeof Metric>;

export const NoveltySignal = z.enum(["not_found", "similar_work_exists", "exact_match"]);

export const PlanSchema = z.object({
  id: z.string(),
  created_at: z.string(),          // ISO
  hypothesis: z.string().min(10),
  domain: z.string(),
  experiment_type: z.string(),

  novelty: z.object({
    signal: NoveltySignal,
    refs: z.array(Reference).max(5),
  }),

  overview: z.object({
    primary_goal: z.string(),
    validation_approach: z.string(),
    success_criteria: z.array(z.string()).min(1),
  }),

  protocol: z.object({
    steps: z.array(ProtocolStep).min(3),
  }),

  materials: z.object({
    items: z.array(Reagent).min(1),
    total_usd: z.number().nonnegative(),
  }),

  budget: z.object({
    lines: z.array(BudgetLine).min(1),
    labor_usd: z.number().nonnegative(),
    overhead_usd: z.number().nonnegative(),
    total_usd: z.number().nonnegative(),
  }),

  timeline: z.object({
    weeks: z.number().int().positive(),
    phases: z.array(TimelinePhase).min(1),
    critical_path: z.array(z.string()).min(1),
    slack_weeks: z.number().int().nonnegative(),
  }),

  validation: z.object({
    metrics: z.array(Metric).min(1),
    controls: z.array(z.string()).min(1),
    statistics: z.string(),
  }),

  provenance: z.object({
    agent_traces: z.array(z.object({
      agent: z.string(),
      model: z.string(),
      latency_ms: z.number(),
      tokens_in: z.number().optional(),
      tokens_out: z.number().optional(),
    })),
    corrections_applied: z.number().int().nonnegative().default(0),
  }),
});
export type Plan = z.infer<typeof PlanSchema>;

// Per-section schemas (used by individual agents for structured output)
export const OverviewSchema   = PlanSchema.shape.overview;
export const ProtocolSchema   = PlanSchema.shape.protocol;
export const MaterialsSchema  = PlanSchema.shape.materials;
export const BudgetSchema     = PlanSchema.shape.budget;
export const TimelineSchema   = PlanSchema.shape.timeline;
export const ValidationSchema = PlanSchema.shape.validation;
