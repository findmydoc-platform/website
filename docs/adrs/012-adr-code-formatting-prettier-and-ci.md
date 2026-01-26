# ADR: Enforce Code Formatting with Prettier (Tailwind v4) and CI Gate

## Status (Table)

| Name    | Content |
| ---     | --- |
| Author  | Sebastian Schütze |
| Version | 1.0 |
| Date    | 26.01.2026 |
| Status  | draft |

## Background

This repository uses a mix of TypeScript, React (Next.js App Router), PayloadCMS, and Tailwind CSS.
Consistent formatting matters because:

- it reduces review noise and merge conflicts
- it improves readability and makes diffs predictable
- it enables deterministic Tailwind class ordering (important for Tailwind CSS v4)

We already rely on Prettier as the primary code formatter and want consistent behavior across:

- local development (VS Code format on save)
- PR validation (CI)

## Problem Description

We observed formatting drift and uncertainty around Tailwind class ordering.
Specifically, Tailwind CSS v4 (CSS-first) changes how tooling discovers Tailwind configuration.
If the Tailwind Prettier plugin cannot resolve Tailwind context, class sorting can become inconsistent or appear inactive, leading to:

- unexpected formatting churn when someone re-runs format later
- PR diffs that are difficult to review
- CI passing even though the repo is not in the canonical formatting state

## Considerations

### Option A: No formatting gate in CI

**Pros**
- fastest CI
- fewer CI failures due to formatting

**Cons**
- formatting drift accumulates
- reviewers must comment on style issues manually
- later formatting runs create large diffs and merge conflicts

### Option B: Enforce formatting via ESLint rule execution (eslint-plugin-prettier)

**Pros**
- single tool for lint + formatting checks
- errors show up as ESLint violations

**Cons**
- slower and noisier lint output
- mixes formatting and lint responsibilities
- harder to keep Tailwind sorting expectations clear

### Option C: Use Prettier as source-of-truth and gate with a Prettier check

**Pros**
- canonical, deterministic formatter output
- fast and clear failure mode (formatting only)
- works well with editor auto-formatting
- avoids ESLint formatting-rule conflicts

**Cons**
- requires contributors to run the project formatter locally (or rely on format-on-save)

### Option D: Tailwind class sorting without explicit Tailwind v4 stylesheet reference

**Pros**
- minimal configuration

**Cons**
- in Tailwind v4 CSS-first setups, the plugin may not have enough context to reliably sort utilities
- can lead to inconsistent class ordering and formatting churn

## Decision with Rationale

We will use **Prettier as the single source of truth for formatting** and enforce it in CI.

1. Local formatting
   - Provide a repository-wide formatting script that applies Prettier consistently across the codebase.
   - VS Code should use Prettier as the default formatter and format on save for supported file types.

2. Tailwind v4 deterministic sorting
   - Configure `prettier-plugin-tailwindcss` with `tailwindStylesheet` pointing at the Tailwind entry CSS.
   - This ensures the plugin can resolve Tailwind v4 context and apply stable class ordering.

3. CI gating (formatting first)
   - CI must run a Prettier check as an early step (right after dependencies are installed) to fail fast on formatting drift.

4. ESLint alignment
   - ESLint must not fight Prettier.
   - Use `eslint-config-prettier` (Flat Config) as the last config entry to disable style rules that conflict with Prettier.

This combination keeps responsibilities clear:

- Prettier: formatting
- ESLint: correctness + best practices
- CI: early, deterministic enforcement

## Technical Debt

- If the Tailwind entry stylesheet path changes, `tailwindStylesheet` must be updated accordingly.
- Periodic dependency upgrades may require re-validating Tailwind sorting behavior.

## Risks (Optional)

- **Large initial diff** when enabling deterministic Tailwind sorting.
   - Mitigation: apply formatting once (single PR) and then keep it enforced via the CI Prettier check.
- **Contributor friction** if developers do not have format-on-save enabled.
  - Mitigation: document the scripts and keep formatting failures actionable.
