# AI Anti-Slop Playbook (v2)

This playbook defines how instruction quality is governed in this repository.

## Objectives

- Reduce low-signal AI output.
- Keep instructions conflict-free and scoped.
- Maintain delivery speed while preserving quality gates.

## Design Principles

1. Critical constraints over volume: make real precedence explicit only where rules can conflict; do not require a P0/P1/P2 label scheme.
2. Minimal constraints: avoid prompt/instruction overload.
3. Conflict-free instruction graph across global and scoped files.
4. Short examples only when they remove ambiguity.
5. Scoped guidance via layered `AGENTS.md` files along the repository path hierarchy.

## Enforcement Model

- Local hook lane:
  - `pre-commit` formats staged supported files, runs zero-warning ESLint on staged JS/TS files, and blocks staged `package.json` changes without `pnpm-lock.yaml`.
  - The hook aborts when managed files are only partially staged, so it does not accidentally stage unstaged hunks.
- Local pre-push lane:
  - `pnpm ai:slop-check:prepush` (runs automatically after `pnpm hooks:install`).
  - Checks only relevant changed instruction files.
- Fast lane (PR blocking):
  - Runtime and CI quality gates required by the main CI workflow.
  - Semgrep runs as a blocking PR check for application changes.
  - AI-slop check is intentionally not a blocking step in the main PR lane.
- Deep lane (main + nightly):
  - Full-scope quality checks including `pnpm ai:slop-check` and Semgrep.

## Checker v2 Contract

- Command: `pnpm ai:slop-check`
- Deterministic signals: per-file line, hard-rule, and example budgets plus cross-file language, tone, and execution conflicts.
- The checker does not require a root-level model-time style policy or attempt to validate response tone from instruction-source wording.
- Modes:
  - `--mode strict` (default): exits non-zero on violations.
  - `--mode report`: emits findings but exits zero.
- Optional report output:
  - `--report-json <path>`
- Changed-files options:
  - `--changed-files <comma-separated>`
  - `--changed-files-file <path>`

## Rule Budgets

Instruction file budgets apply to scanned instruction sources, including layered `AGENTS.md`, `AGENTS.override.md`, Codex specialist agents, rules, local skill instructions, and scoped AI governance playbooks:
- line budget
- hard-rule density budget
- example-block budget

## Conflict Handling

The checker blocks contradictory instruction sets, including:
- language conflicts (German vs English chat directives)
- tone conflicts (filler prohibited vs filler encouraged)
- execution conflicts (always build vs skip build)

## False Positives and Exceptions

Use temporary exceptions only if a finding is confirmed as noise and cannot be fixed immediately.
Each exception requires:
- owner
- rationale
- expiration date
- issue/PR reference

## Review Checklist for New Instructions

1. Are critical constraints and any real precedence clear without adding an unnecessary label scheme?
2. Is the rule scoped to the closest required `AGENTS.md` level (and only global where necessary)?
3. Is the rule set concise and non-redundant?
4. Are there conflicts with `AGENTS.md` and nested `AGENTS.md` files?
5. Are examples short and necessary?
6. Does `pnpm ai:slop-check` pass locally?
7. For changed instruction sources, has `agent_instruction_reviewer` checked semantic quality and any `5/10` decision gates?

## KPIs

- Weekly `knip` findings trend.
- PRs failing dependency/dead-code gates.
- Review rework rounds per PR.
- Post-merge hotfix rate.
- Mean time to merge.
