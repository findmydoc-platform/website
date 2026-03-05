# AI Anti-Slop Playbook (v2)

This playbook defines how instruction quality is governed in this repository.

## Objectives

- Reduce low-signal AI output.
- Keep instructions conflict-free and scoped.
- Maintain delivery speed while preserving quality gates.

## Design Principles

1. Priority over volume: keep P0/P1/P2 explicit.
2. Minimal constraints: avoid prompt/instruction overload.
3. Conflict-free instruction graph across global and scoped files.
4. Short examples only when they remove ambiguity.
5. Scoped guidance via `applyTo`; global scope requires explicit rationale.

## Enforcement Model

- Local pre-push lane:
  - `pnpm ai:slop-check:prepush` (runs automatically after `pnpm hooks:install`).
  - Checks only relevant changed instruction files.
- Fast lane (PR blocking):
  - Runtime and CI quality gates required by the main CI workflow.
  - AI-slop check is intentionally not a blocking step in the main PR lane.
- Deep lane (main + nightly):
  - Full-scope quality checks including `pnpm ai:slop-check`.

## Checker v2 Contract

- Command: `pnpm ai:slop-check`
- Modes:
  - `--mode strict` (default): exits non-zero on violations.
  - `--mode report`: emits findings but exits zero.
- Optional report output:
  - `--report-json <path>`
- Changed-files options:
  - `--changed-files <comma-separated>`
  - `--changed-files-file <path>`

## Rule Budgets

Policy file (`.github/instructions/ai-anti-slop.instructions.md`):
- max 120 lines
- max 8 hard rules

Instruction file budgets (scanned instruction sources):
- line budget
- hard-rule density budget
- example-block budget

## Conflict Handling

The checker blocks contradictory instruction sets, including:
- language conflicts (German vs English chat directives)
- tone conflicts (forbid filler vs allow filler)
- execution conflicts (always build vs skip build)

## False Positives and Exceptions

Use temporary exceptions only if a finding is confirmed as noise and cannot be fixed immediately.
Each exception requires:
- owner
- rationale
- expiration date
- issue/PR reference

## Review Checklist for New Instructions

1. Does the file declare clear priorities (P0/P1/P2 or equivalent)?
2. Is `applyTo` scoped narrowly, or does it include a `Scope exception:` rationale?
3. Is the rule set concise and non-redundant?
4. Are there conflicts with `AGENTS.md` or `.github/copilot-instructions.md`?
5. Are examples short and necessary?
6. Does `pnpm ai:slop-check` pass locally?

## KPIs

- Weekly `knip` findings trend.
- PRs failing dependency/dead-code gates.
- Review rework rounds per PR.
- Post-merge hotfix rate.
- Mean time to merge.
