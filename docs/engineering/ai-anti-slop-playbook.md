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
