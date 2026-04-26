# How "The AI Scientist" Works

Your app is a **4-stage interactive pipeline** styled as a top-down scientist's desk. Here's the flow a user experiences:

## 🎬 Stage 1 — The Empty Desk (Input)

The user lands on a warm beige desk surface with **only a notebook** in the center. The notebook has spiral binding, a red margin line, and ruled lines — visually mimicking a real lab notebook.

- They type a hypothesis (e.g., *"Can we improve solar cell efficiency by testing alternative materials?"*)
- A "↳ Use example" link auto-fills the sample hypothesis
- Hitting **Analyze** triggers a ~900ms "Screening…" loader

## 📄 Stage 2 — The Paper Drops

The notebook disappears. A **single Paper object** animates dropping onto the desk (with a slight bounce + rotation settle via the `desk-drop` keyframe). The hypothesis moves up into the sticky header as an "H₀" pill.

After ~800ms, the **Literature QC modal auto-opens** showing:

- A **Novelty Signal badge** (Similar Work / Partial Overlap / Novel) with a pulsing dot
- 3 mock papers with similarity %, authors, venue, year, and DOI links
- A prominent **"Generate Full Plan"** CTA in the footer

## 🖥️ Stage 3 — The Desk Fills

Clicking "Generate Full Plan" shows a ~1.1s "Synthesizing…" state, then closes the modal and **animates 4 more objects dropping in** (staggered): Monitor, Clipboard, Clock, and Vault.

## 🔍 Stage 4 — Explore the Plan

Each desk object is clickable, lifts on hover with a colored glow, and opens a modal with a blurred backdrop:

| Object                | Modal Content                                                                    |
| --------------------- | -------------------------------------------------------------------------------- |
| 📄**Paper**     | Literature QC — novelty + reference list                                        |
| 🖥️**Monitor** | Overview — primary goal, validation approach, success criteria                  |
| 📋**Clipboard** | Protocol — numbered steps with phase tags, durations, hover-to-annotate buttons |
| 🕐**Clock**     | Timeline — 10-week Gantt chart with color-coded phases & critical path          |
| 🏦**Vault**     | Materials & Budget — editable reagent table with live total                     |

All modals close via **X button, ESC key, or backdrop click**. Body scroll is locked while open.

## 🎨 Design Language

- **Palette**: Warm beige background, charcoal text, off-white cards, espresso primary, neon-pastel signals (mint, amber, cyan, violet, rose) for category coding
- **Typography**: *Instrument Serif* italic for display (journal-like), JetBrains Mono for data/labels
- **Header**: Sticky, backdrop-blurred, shows logo + truncated hypothesis once submitted, with a "New" reset button

## 🧠 Architecture

- **State machine**: `"input" → "paper-only" → "full-desk"` in `src/routes/index.tsx`
- **Mock data**: All plan content lives in `src/lib/mock-data.ts` (no backend yet — it's a hackathon demo)
- **Reusable modal**: `DeskModal` component handles backdrop, ESC, scroll-lock, sizing
- **Desk scene**: `DeskScene` renders objects based on a `visibleItems` array, with staggered drop animations
