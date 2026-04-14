# CI Modularization Plan

This document captures the current CI workflow boundaries and the remaining follow-up work after the first modularization pass.

## Design goals

- Keep pull request checks focused on merge-critical signals.
- Separate validation, workflow security, deployment, and nightly hygiene concerns.
- Reduce duplicated checks across the fast lane and deep lane.
- Keep required checks easy to understand in GitHub.
- Prefer incremental refactors over a one-shot CI rewrite.

## Current workflow topology

The repository now uses a hybrid workflow model with clear top-level ownership:

- `deploy.yml` is the primary **PR Validation** workflow.
- `workflow-security.yml` owns workflow and secret-scan validation.
- `deploy-preview.yml` owns preview deployment.
- `deploy-production.yml` owns manual production deployment.
- `deep-quality-lane.yml` owns broad repository hygiene.
- `pr-gates.yml`, `docs-check.yml`, `admin-e2e-smoke.yml`, and the maintenance workflows remain separate focused workflows.

This keeps the main PR validation path distinct from workflow security, deployment, and nightly quality hygiene.

## Workflow ownership

### `deploy.yml`

Purpose: merge-critical runtime validation.

Current scope:

- formatting check
- permission matrix derivation and verification
- migration diff checks
- payload type checks
- story governance check
- lint
- unit tests
- Storybook tests
- build
- integration tests for targeted PR paths and on `main`
- combined coverage reporting

### `workflow-security.yml`

Purpose: workflow and repository security validation.

Current scope:

- `actionlint`
- `zizmor`
- `detect-secrets`

Trigger strategy:

- PRs that touch workflow/security-relevant files
- pushes to `main` that touch workflow/security-relevant files
- nightly schedule
- manual dispatch

### `deploy-preview.yml`

Purpose: preview deployment only.

Current scope:

- trigger on successful `PR Validation`
- preview deploy
- preview alias update on `main`
- preview summary output

### `deploy-production.yml`

Purpose: production deployment only.

Current scope:

- manual dispatch only
- main-branch guard
- production deploy
- production alias update
- production summary output

### `deep-quality-lane.yml`

Purpose: broad hygiene, not standard PR blocking.

Current scope:

- `pnpm ai:slop-check`
- `pnpm deadcode:check`
- `pnpm deps:graph:check`
- `pnpm deps:dedupe:check`
- `pnpm deps:audit`

## Gate placement

| Check | Primary home | Why |
| --- | --- | --- |
| `pnpm format:check` | PR validation | Fast, deterministic, merge-critical |
| permission matrix checks | PR validation | Access-control regression guard |
| migration diff / committed migration enforcement | PR validation | Prevents deploy drift |
| `pnpm run check:payload-types` | PR validation | Merge-critical |
| `pnpm lint` | PR validation | Merge-critical |
| story governance check | PR validation | Existing repo policy |
| unit tests | PR validation | Core quality signal |
| Storybook tests | PR validation | UI quality signal |
| build | PR validation | Deploy confidence |
| integration tests | targeted PR paths + `main` | Expensive, but still important for backend-sensitive changes |
| combined coverage | reporting only | Useful signal, weak merge gate |
| `actionlint` | workflow security | Workflow safety concern |
| `zizmor` | workflow security | Workflow security concern |
| `detect-secrets` | workflow security | Secret hygiene concern |
| `pnpm ai:slop-check` | local pre-push + deep lane | Existing repo policy |
| `pnpm deadcode:check` | deep lane | Broad hygiene, not standard merge gate |
| `pnpm deps:graph:check` | deep lane | Architectural hygiene |
| `pnpm deps:dedupe:check` | deep lane | Hygiene, with separate autofix workflow |
| `pnpm deps:audit` | deep lane | Broad dependency hygiene |

## What stays intentionally separate

These workflows remain intentionally focused and are not part of the modularization problem:

- `pr-gates.yml`
- `docs-check.yml`
- `admin-e2e-smoke.yml`
- `dependency-dedupe-autofix.yml`
- `dependency-health-nightly.yml`
- `deploy-storybook.yml`
- `reset-database.yml`

## Remaining follow-up work

### 1. Required checks and branch protection

Update GitHub branch protection so the required checks reflect the new workflow boundaries:

- `PR Validation`
- `Workflow Security`
- any intentionally required specialized workflows such as docs or admin smoke

Do not require `Deep Quality Lane` or combined coverage as merge gates.

### 2. Reusable workflow extraction

Node/pnpm setup is still repeated across several workflows.

Possible follow-up:

- extract only the repeated setup patterns that are reused often enough to justify the indirection
- keep top-level workflow intent obvious in GitHub

### 3. Integration trigger tuning

The current targeted PR-path rules are intentionally conservative.

Possible follow-up:

- widen them if backend regressions escape too often
- narrow them if PR runtimes remain too high for common frontend-only work

## Decision defaults

These defaults guide future CI changes in this repository:

- Prefer a small number of concern-specific workflows over one giant workflow.
- Do not create a separate workflow for every individual tool.
- Keep PR-blocking checks focused on correctness and deploy confidence.
- Treat workflow security, deployment, and nightly hygiene as separate operational concerns.
- Treat combined coverage as reporting unless it becomes a real decision gate.
