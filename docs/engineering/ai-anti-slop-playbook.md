# AI Anti-Slop Playbook

This playbook defines how AI-assisted changes are evaluated in this repository.

## Objectives

- Reduce low-signal AI output.
- Enforce evidence-first engineering communication.
- Catch dead code and dependency drift early.

## Required Gates

- `pnpm ai:slop-check`
- `pnpm deadcode:check`
- `pnpm deps:graph:check`
- `pnpm deps:dedupe:check`
- `pnpm deps:audit`

## CI Lane Strategy

- Fast lane (blocking PR): core quality checks and tests.
- Deep lane (push to `main` + nightly): expensive quality and security checks.
- Pull requests use changed-file gating for deep checks:
  - dependency checks only when dependency manifests changed
  - workflow security checks only when workflow/security files changed

## Changed-File Mode (PR)

`ai:slop-check` supports a changed-files mode in PR CI.

- PR workflow builds a changed-file list from `origin/main...HEAD`.
- Only these documentation paths are scanned in changed-files mode:
  - `AGENTS.md`
  - `.github/copilot-instructions.md`
  - `.github/instructions/**/*.md`
  - `.github/prompts/**/*.md`
  - `.github/agents/**/*.md`
- Full-scope scanning is still used outside PR changed-files mode.

This keeps PR feedback fast while preserving full policy enforcement in deep runs.

## Expected Response Quality

- Direct and factual wording.
- Concrete evidence for technical claims.
- Clear uncertainty labeling when needed.

Use labels:

- `Assumption:` for inferred but unverified details.
- `Confidence:` for evidence strength.

## KPIs

- Weekly `knip` finding count.
- PRs failing dependency and dead-code gates.
- Review rework rounds per PR.
- Post-merge hotfix frequency.
- Mean time to merge.

## Rollout Notes

- Gates are blocking in PR CI.
- Nightly dependency report runs on schedule and is uploaded as an artifact.
- Dependabot remains the weekly dependency update mechanism.

## False Positives and Exceptions

Use temporary exceptions only when a finding is confirmed as noise and cannot be resolved immediately.

- Every exception must include:
  - owner
  - rationale
  - expiration date
  - issue or PR reference
- Expired exceptions must be removed or renewed with a new rationale.
- Do not use exceptions to bypass confirmed defects.

## Existing Findings Tracking

Track known findings in a single engineering record and keep it current.

Minimum fields:

- tool
- finding summary
- severity
- owner
- target resolution date
- status (`open`, `in-progress`, `resolved`, `waived`)
- tracking reference (issue/PR URL)

This keeps temporary debt visible and prevents silent quality drift.
