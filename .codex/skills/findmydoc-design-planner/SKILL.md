---
name: findmydoc-design-planner
description: Create repository-grounded findmydoc design planning packages with generated image mockups, one self-contained scenario folder, mobile/tablet/desktop examples, user journeys, Mermaid flows, data-model notes, component plans, and review-ready requirements. Use when Codex needs to plan a new or redesigned findmydoc UI before implementation, explore patient-facing design concepts with imagegen mockups, document design alternatives under docs/roadmap, or prepare a plan for the plan_design_reviewer.
---

# findmydoc Design Planner

## Overview

Use this skill to create implementation-ready design planning packages for findmydoc. The output is a self-contained scenario folder that pairs generated bitmap mockups with a written contract strict enough for review and implementation.

Default output path: `docs/roadmap/<topic-slug>/<scenario-slug>/`.

## Hard Rules

- Keep `findmydoc` lowercase.
- If a mockup shows the findmydoc logo or wordmark, use the real dark logo from `public/fmd-logo-1-dark.png` as an imagegen reference. Treat `public/fmd-logo-1-dark.svg` as the implementation source used by the existing `Logo` component.
- Create one self-contained folder per scenario or proposal.
- Generate at least three mockups for each scenario: `mobile.png`, `tablet.png`, and `desktop.png`.
- Show all relevant functions for each form factor; do not generate decorative preview-only screens.
- Document every visible UI element, metric, badge, button, icon, tab, status, and implied interaction before treating it as implementable.
- Treat anything not documented in the Visible UI Contract as out of implementation scope.
- Do not invent trust signals, data sources, backend capabilities, or clinic claims. Mark gaps as `Data Gap`.
- For comparison flows, allow more than 3 favorited clinics but cap active comparison at 3 clinics.
- Keep the design calm, medically trustworthy, transparent, and consistent with the existing site.

## Workflow

1. Read repo instructions and context:
   - root `AGENTS.md`
   - nearest path-local `AGENTS.md` files
   - relevant current implementation under `src/app/(frontend)/**`, `src/components/**`, and `src/collections/**`
   - existing docs or Playwright screenshots when available
2. Pick slugs and scaffold the scenario folder:
   ```bash
   python .codex/skills/findmydoc-design-planner/scripts/init_design_plan.py \
     --topic <topic-slug> \
     --scenario <scenario-slug> \
     --title "<Human title>"
   ```
3. Read `references/design-plan-contract.md` before writing the README.
4. Read `references/mockup-prompting.md` before generating image prompts.
5. Use `$imagegen` in built-in mode for mockups unless the user explicitly requests its CLI fallback.
6. When a prompt includes a visible findmydoc logo, first inspect `public/fmd-logo-1-dark.png` with the image viewer and label it as the brand logo reference for imagegen.
7. Move or copy final project-bound mockups from `$CODEX_HOME/generated_images/...` into the scenario folder as:
   - `mobile.png`
   - `tablet.png`
   - `desktop.png`
8. Fill the README completely:
   - current-state grounding
   - user journey with Mermaid flow
   - requirements
   - visual mockup descriptions
   - Visible UI Contract
   - data model plan
   - component plan
   - acceptance criteria
   - specialist review handoff
9. Explain what each mockup intentionally changes from the current implementation.
10. After the folder is complete, recommend running `plan_design_reviewer` on exactly that one scenario folder.

## Output Contract

Every scenario README must be written in English and include:

- Executive Summary
- Current State
- User Journey
- Mermaid Flow
- Functional Requirements
- Visual Mockups
- Visible UI Contract
- Data Model Plan
- Component Plan
- Differences From Current Implementation
- Acceptance Criteria
- Specialist Review Handoff
- Assumptions and Data Gaps

Use `references/design-plan-contract.md` as the exact section contract.

## Mockup Rules

- Use generated bitmap images for the design examples.
- Use existing screenshots, Storybook states, or code-derived UI facts as visual grounding before prompting imagegen.
- Generate distinct prompts for mobile, tablet, and desktop instead of resizing one concept.
- Include real UI density for each viewport:
  - mobile: primary path, core controls, readable stacking, bottom or inline actions when appropriate
  - tablet: split or two-column adaptations only when they serve clarity
  - desktop: richer comparison and scanning density without hiding patient-critical information
- Avoid decorative blobs, ornamental cards, fake dashboards, unsupported badges, and unverified metrics.
- If the findmydoc logo appears, use the real dark logo as visual reference and document the logo placement in the Visible UI Contract.
- If image text may be imperfect, keep labels short and restate exact intended labels in the README.

Read `references/mockup-prompting.md` for prompt scaffolds.

## Review Gate

Before handoff, check:

- The folder contains `README.md`, `mobile.png`, `tablet.png`, and `desktop.png`.
- Every shown function has patient value, trust/transparency purpose, source of truth, component ownership, and allowed behavior.
- Every unknown source is marked as `Data Gap`.
- The Mermaid flow matches the written user journey.
- The data model plan names collections, fields, relationships, permissions, provenance, and freshness needs.
- The component plan classifies each feature as reuse, change, or new.
- The README states which specialist reviewers are needed after implementation.

## Resources

- `references/design-plan-contract.md`: required README structure and tables.
- `references/mockup-prompting.md`: imagegen prompt rules for findmydoc mobile, tablet, and desktop mockups.
- `scripts/init_design_plan.py`: creates the self-contained scenario folder and README starter.
