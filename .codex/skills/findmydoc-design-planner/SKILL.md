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
- Ground every mockup in current product branding before image generation. Capture fresh Playwright or Storybook screenshots of the relevant existing route/component states and save them under `output/playwright/` unless the target cannot run locally.
- For data-driven routes, run the appropriate local seed or fixture before screenshots whenever the local runtime supports it. Document the seed command and resulting counts or blocker in the scenario README.
- Match the route's real authentication and chrome state. Private patient routes must not show guest `Sign in` chrome unless the explicit scenario is an unauthenticated redirect or login state.
- Create one self-contained folder per scenario or proposal.
- Generate at least three mockups for each scenario: `mobile.png`, `tablet.png`, and `desktop.png`.
- Show all relevant functions for each form factor; do not generate decorative preview-only screens.
- Do not combine mutually exclusive runtime states in one mockup. For example, do not show an empty state on the same page state as populated results; document the alternate state in the README or create an additional clearly named mockup.
- Cover meaningful runtime states with separate mockups or screenshots. For data-driven pages, include populated and empty states for each form factor when both states can occur. For mutating controls, include pending and error states when those states materially affect layout, trust, or accessibility.
- Document every visible UI element, metric, badge, button, icon, tab, status, and implied interaction before treating it as implementable.
- Document global chrome separately from issue-owned UI. Header nav items, mobile menu triggers, account triggers, footer links, decorative icons, repeated CTAs, and helper copy must be covered in the Visible UI Contract when they appear in a mockup.
- Treat anything not documented in the Visible UI Contract as out of implementation scope.
- Do not invent trust signals, data sources, backend capabilities, or clinic claims. Mark gaps as `Data Gap`.
- Do not leak adjacent feature framing into a narrow scenario. If comparison, contact, dashboard, recommendation, or account features are out of scope, mockup copy and controls must stay neutral even when the route links to an existing adjacent page.
- For comparison flows, allow more than 3 favorited clinics but cap active comparison at 3 clinics.
- Keep the design calm, medically trustworthy, transparent, and consistent with the existing site.

## Workflow

1. Read repo instructions and context:
   - root `AGENTS.md`
   - nearest path-local `AGENTS.md` files
   - relevant current implementation under `src/app/(frontend)/**`, `src/components/**`, and `src/collections/**`
   - existing docs or Playwright screenshots when available
2. Capture visual grounding for branding and layout:
   - for data-driven routes, run the relevant seed or fixture first so screenshots show realistic populated data
   - use Playwright or Storybook to screenshot the current relevant route/component states
   - save screenshots under `output/playwright/<topic-or-scenario>/`
   - capture mobile first, then tablet or desktop when those form factors are in scope
   - document the seed command, success counts, or exact seed blocker in the scenario README `Current State`
   - document the screenshot paths in the scenario README `Current State`
   - if local runtime or authentication blocks a screenshot, document the exact blocker and use the nearest available Storybook/component screenshot instead
3. Pick slugs and scaffold the scenario folder:
   ```bash
   python .codex/skills/findmydoc-design-planner/scripts/init_design_plan.py \
     --topic <topic-slug> \
     --scenario <scenario-slug> \
     --title "<Human title>"
   ```
4. Read `references/design-plan-contract.md` before writing the README.
5. Read `references/mockup-prompting.md` before generating image prompts.
6. Use `$imagegen` in built-in mode for mockups unless the user explicitly requests its CLI fallback.
7. When a prompt includes a visible findmydoc logo, first inspect `public/fmd-logo-1-dark.png` with the image viewer and label it as the brand logo reference for imagegen.
8. Move or copy final project-bound mockups from `$CODEX_HOME/generated_images/...` into the scenario folder as:
   - `mobile.png`
   - `tablet.png`
   - `desktop.png`
   - optional state-specific mockups such as `mobile-empty.png`, `tablet-empty.png`, `desktop-empty.png`, `mobile-error.png`, or `desktop-pending.png` when those states are in scope
9. Fill the README completely:
   - current-state grounding
   - visual branding references and screenshot paths used before imagegen
   - user journey with Mermaid flow
   - requirements
   - visual mockup descriptions
   - state coverage matrix for populated, empty, pending, error, and other meaningful states
   - Visible UI Contract
   - data model plan
   - component plan
   - acceptance criteria
   - specialist review handoff
10. Explain what each mockup intentionally changes from the current implementation.
11. After the folder is complete, recommend running `plan_design_reviewer` on exactly that one scenario folder.

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
- Use fresh Playwright or Storybook screenshots as visual grounding before prompting imagegen. Code-derived UI facts can supplement screenshots, but cannot replace them unless local runtime or authentication blocks screenshot capture.
- Match current product branding from the grounding screenshots: typography, spacing rhythm, button treatment, card radius, border weight, color tokens, header/footer treatment, and density. Do not substitute a generic healthcare dashboard style.
- Match route state, not just visual style. Show authenticated account chrome for authenticated/private route states and guest chrome only for public or unauthenticated states.
- Treat state coverage as part of the design artifact. The main `mobile.png`, `tablet.png`, and `desktop.png` should show the primary populated path unless the scenario is inherently empty-state-first. Empty, pending, and error states should be separate files when they are visually meaningful.
- Include acceptance criteria for the repo's canonical responsive checks, including the `1280px` check when media, summary panels, wide rows, or other desktop-sensitive layout behavior is in scope.
- Generate distinct prompts for mobile, tablet, and desktop instead of resizing one concept.
- Include real UI density for each viewport:
  - mobile: primary path, core controls, readable stacking, bottom or inline actions when appropriate
  - tablet: split or two-column adaptations only when they serve clarity
  - desktop: richer comparison and scanning density without hiding patient-critical information
- Keep each mockup to one coherent runtime state. If empty, loading, pending, error, or populated states are all important, either choose the primary state for `mobile.png`/`tablet.png`/`desktop.png` and document the others in the README, or add optional extra mockups with explicit state names.
- For data-driven pages, the default expectation is:
  - `mobile.png`, `tablet.png`, `desktop.png`: populated primary state
  - `mobile-empty.png`, `tablet-empty.png`, `desktop-empty.png`: empty state when no data is a real user state
  - `*-pending.png` or `*-error.png`: only when mutation/loading/error states are visually or behaviorally important
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
