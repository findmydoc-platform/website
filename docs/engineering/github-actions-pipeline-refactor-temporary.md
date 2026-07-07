# Temporary GitHub Actions Pipeline Refactor Plan

This document is the implementation handoff for a possible larger pipeline refactor. It intentionally does not change workflows. Use it after the quickwin PR has run long enough to show whether more work is justified.

## Current workflow shape

The repository already separates the main CI concerns:

- `PR Validation` owns merge-critical static checks, unit tests, Storybook tests, build, targeted integration tests, and coverage reporting.
- `DB Quality` owns migration and schema safety with a stable `db-quality-gate` job.
- `Workflow Security` owns workflow linting, zizmor, and secret scanning for workflow/security changes plus scheduled coverage.
- `Deploy Preview` owns preview deployment for deployable changes.
- `Admin E2E Smoke` owns admin and public Playwright smoke coverage.
- `Deep Quality Lane` owns broad nightly hygiene.

The current high-cost gaps are routing gaps, not proof that the pipeline needs a full rewrite. A docs-only PR can still run E2E smoke checks, and several jobs repeat checkout, pnpm setup, install, browser cache setup, coverage publication, and artifact upload.

## Baseline to collect before refactoring

Collect 14 to 30 days of GitHub Actions data before changing the architecture. Capture workflow name, job name, event, branch, conclusion, start time, end time, duration, rerun count, and whether the job was required for merge.

Recommended command shape:

```bash
rtk gh run list --repo findmydoc-platform/website --limit 200 --json databaseId,workflowName,event,headBranch,conclusion,createdAt,updatedAt,url
rtk gh run view <run-id> --repo findmydoc-platform/website --json jobs
```

Classify the data into these change classes:

| Change class | Examples | PR feedback target |
| --- | --- | --- |
| docs | `README.md`, `docs/**`, Markdown-only ADRs | docs check and policy gates |
| workflow/security | `.github/workflows/**`, `.github/actions/**`, `.secrets.baseline`, `zizmor.yml` | workflow security and repository policy gates |
| frontend/ui | route components, blocks, shared UI, CSS, public assets | static checks, unit/Storybook/build, targeted UI smoke when relevant |
| backend/api | API routes, auth, access, hooks, server utilities | static checks, unit/build, targeted integration |
| Payload/DB | collections, migrations, Payload config, schema-adjacent hooks | DB quality, integration, build |
| dependency | `package.json`, `pnpm-lock.yaml`, GitHub Actions dependencies | risk-tiered checks based on dependency type |
| deployable | runtime sources and build/deploy configuration | PR validation and deploy preview |
| E2E | Playwright config, E2E tests/helpers, E2E runtime server, runtime surfaces covered by smoke | E2E smoke gate |

## Refactor decision

A larger refactor is justified only if the quickwins still leave repeated waste in common PRs or if required checks remain hard to understand. The larger refactor should not be a full rewrite. It should consolidate routing decisions and preserve the existing concern boundaries.

Do not refactor when the baseline shows the remaining cost comes mostly from intentional runtime, dependency, or deployment validation.

## Target architecture

Introduce one shared change classifier and make existing workflows consume its outputs:

- A lightweight classifier job or reusable workflow produces `docs`, `workflow_security`, `frontend_ui`, `backend_api`, `payload_db`, `dependency`, `deployable`, and `e2e` outputs.
- `PR Validation` remains the fast merge-critical workflow, but individual expensive jobs use classifier outputs instead of local one-off path filters.
- `DB Quality` keeps the stable `db-quality-gate` and uses classifier output only to avoid duplicate path logic, not to weaken DB safety.
- `Admin E2E Smoke` keeps a stable gate and runs smoke tests only when `e2e` or high-risk runtime classes require it.
- `Deploy Preview` runs only for `deployable` changes, trusted same-repository PRs, `main`, and manual dispatch.
- `Deep Quality Lane` stays scheduled/manual and does not become PR-blocking.
- CodeQL stays on the current default setup unless measurement shows it is a material cost source for low-signal PRs. If it is material, move to checked-in advanced setup with explicit path routing in a separate security-reviewed PR.

## Implementation sequence

1. Add a read-only classifier workflow or shared action.
   - Inputs: event name, base ref, changed paths.
   - Outputs: the eight change classes above plus a summary for GitHub Step Summary.
   - Validation: synthetic path cases for docs-only, workflow-only, frontend, backend, Payload/DB, dependency, deployable, and E2E.

2. Move `Admin E2E Smoke` to the shared classifier.
   - Keep `E2E Smoke Gate` as the stable required-check candidate.
   - Preserve manual dispatch as always-run.

3. Move `PR Validation` path decisions to the shared classifier.
   - Keep Static Checks as the broad baseline.
   - Run Storybook tests for frontend/UI, Storybook, dependency, and manual cases.
   - Run Integration Tests for backend/API, Payload/DB, dependency, `main`, and manual cases.
   - Run Build for deployable, dependency, `main`, and manual cases.
   - Run Combined Coverage only when at least one coverage-producing job ran.

4. Move `Deploy Preview` routing to the shared classifier.
   - Preserve the trusted-source guard for PR secrets.
   - Keep `main` alias behavior unchanged.

5. Review repository settings.
   - Required checks should point only at stable gates: PR validation gate, `DB Quality / db-quality-gate`, `E2E Smoke Gate` if E2E remains required, workflow security gate if workflow/security changes are required.
   - Do not require path-skipped implementation jobs directly.

6. Consider CodeQL advanced setup only after measurement.
   - Keep security reviewer approval as a decision gate.
   - Preserve language coverage for Actions, JavaScript/TypeScript, and Python.

## Feedback signals that must not be lost

- Workflow changes still need actionlint, zizmor, and secret scanning.
- Auth, access-control, API, Payload, schema, and migration changes still need targeted backend or DB validation.
- Runtime dependency and framework updates still need broad build/test coverage.
- Same-repository PRs that can deploy must keep preview deploy confidence unless the classifier proves the change is non-deployable.
- Public and admin smoke coverage must still run for runtime surfaces that those tests protect.
- Required checks must never remain pending because an implementation job was path-skipped.

## Acceptance criteria for the later refactor

- Docs-only PRs run no runtime build, preview deploy, E2E smoke, or broad test jobs.
- Workflow-only PRs run workflow security and repository policy checks without runtime deployment or E2E smoke.
- Runtime PRs retain PR validation, build, deploy preview when trusted, and relevant smoke coverage.
- Payload/DB PRs retain DB quality and targeted integration coverage.
- Dependency PRs use risk-tiered routing with conservative fallback for runtime, framework, test-runner, and security updates.
- The required-check list contains only stable gates.
- The baseline report shows lower billed work for low-risk PRs without removing high-signal validation from risky PRs.

## Out of scope for the quickwin PR

- No central classifier implementation.
- No CodeQL configuration migration.
- No branch-protection or ruleset change.
- No workflow consolidation.
- No removal of existing security, DB, deployment, or runtime validation signals.
