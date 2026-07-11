---
name: findmydoc-design-handoff
description: Turn a selected Product Design direction into a repository-grounded findmydoc implementation handoff. Use after visual exploration or a prototype has a chosen direction and the team needs scope, data, component, acceptance, and review boundaries. Do not use for initial visual ideation, UX audits, or prototype builds.
---

# findmydoc Design Handoff

Create an evidence-based implementation handoff after a visual direction is selected. This skill does not generate mockups, run generic UX audits, or build prototypes.

## Product Design Routing

Use the installed Product Design plugin for the work it owns. Refer to focused skills by capability, never by a versioned local plugin path.

- For visual exploration, use Product Design `get-context` and `ideate`; wait for the user to select a direction.
- For an explicit critique of an existing flow, use Product Design `audit`; do not add an audit just to create this handoff.
- For a runnable prototype, use Product Design `image-to-code` and its required `design-qa` gate after a direction is selected.
- Do not repeat the plugin's ImageGen prompts, screenshot procedure, option count, viewport defaults, asset rules, or prototype QA rules here.
- If the plugin is unavailable, report the missing dependency instead of recreating its workflow here.

Give Product Design only the relevant repository facts: current route and component evidence, existing design-system sources, and the selected auth or account state. If a visible findmydoc logo is required, provide `public/fmd-logo-1-dark.png` as the visual reference; implementation uses `public/fmd-logo-1-dark.svg` through `src/components/molecules/Logo/Logo.tsx`.

## Repository Grounding

Before writing the handoff:

1. Read the root and nearest path-local `AGENTS.md` files.
2. Inspect active route composition, components, collections, and current visual evidence. Treat dormant components as reference only.
3. Record durable visual truth for the selected direction: a committed image path, stable Figma URL, or image attachment recorded in the authoritative issue. A direction name or a chat-only option number is not sufficient; stop and request an accessible reference when it is missing.
4. Separate reused global chrome from issue-owned UI.
5. Verify each visible claim, metric, source, permission, and backend capability. Mark unknowns as `Data Gap`; do not invent them.

## Handoff Contract

Write the handoff in English using `references/implementation-handoff-template.md`.

- Follow the user or issue's chosen canonical source for implementation requirements. Do not default to `docs/roadmap`.
- Without a named authoritative destination, return the handoff inline and create no repository file. Ask for a destination before creating a persistent artifact.
- If the user explicitly requests a record under `docs/roadmap`, label it as a historical design record. It is not an authoritative engineering source.
- Treat anything outside the Visible UI Contract and explicit scope as out of scope.
- Keep data ownership, provenance, permissions, and component ownership concrete enough for an implementation issue or PR.
- Derive responsive, accessibility, and reviewer expectations from the planned implementation and current repository rules; do not hard-code a generic reviewer list.

## Completion Gate

Before handoff, confirm:

- Durable visual truth and current implementation evidence are named and accessible.
- Every visible or implied feature has an owner, data source, and allowed behavior, or is a `Data Gap`.
- Scope, exclusions, data changes, component changes, and acceptance criteria are explicit.
- The destination's authority is clear, especially for historical roadmap records.
- The review handoff names only reviewers justified by the expected implementation diff.

## Resource

- `references/implementation-handoff-template.md`: required structure for a versioned or issue-linked implementation handoff.
