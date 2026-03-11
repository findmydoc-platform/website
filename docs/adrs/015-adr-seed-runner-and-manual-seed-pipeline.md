# ADR: Consolidated Seed Runner and Manual Seed Pipeline

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.0 |
| Date | 11.03.2026 |
| Status | accepted |

## Background

Seed data is currently executed through local scripts and a request-bound `/api/seed` endpoint.
Media-heavy seed runs can take longer than hosted request limits in preview environments, which causes timeout failures even though the seed logic itself is valid.

## Problem Description

We need a consistent, policy-safe way to execute baseline and demo seeds across local development and CI/CD environments.
The solution must avoid endpoint timeout constraints for long-running media uploads, preserve production safety rules, and minimize structural churn in existing seed assets.

## Considerations

1. Keep multiple dedicated local scripts (`seed:baseline`, `seed:demo`, reset variants)
   - Pros: no immediate command changes
   - Cons: duplicated orchestration and policy logic; higher drift risk between local and automation paths

2. Use endpoint-only seeding from automation (`/api/seed`)
   - Pros: no CLI changes
   - Cons: still request-bound and vulnerable to timeout limits; harder to operate reliably for media-heavy runs

3. Consolidate to one CLI runner and execute automation through that runner (chosen)
   - Pros: single source of truth for seed orchestration and environment policy; avoids request-bound runtime limits; same behavior locally and in workflows
   - Cons: breaking command change for local users; introduces an additional operational workflow

## Decision with Rationale

We consolidate seed execution to a single CLI command (`pnpm seed:run`) and add a dedicated manual GitHub workflow (`.github/workflows/seed.yml`) that invokes the same command.

Policy is enforced in both runner and workflow:

- Baseline is allowed in all runtimes.
- Demo is blocked in production.
- Reset is blocked in production.

Seed assets remain in the existing root directory and are split side-by-side into:

- `src/endpoints/seed/assets/baseline/**`
- `src/endpoints/seed/assets/demo/**`

This keeps repository changes minimal while clarifying ownership and intent of seed media.

## Technical Debt

This is a temporary operational solution.
It preserves a seed system that may be replaced by a future provisioning/import strategy and adds workflow maintenance overhead in the meantime.

## Risks (Optional)

- Operational misuse risk if workflow inputs are selected incorrectly.
  - Mitigation: duplicate policy checks in workflow and runner.
- Local command migration risk after removing old seed script aliases.
  - Mitigation: update all setup and seeding documentation.

## Exit Criteria for Replacement

This ADR should be revisited when at least one of the following becomes true:

- seed data is no longer managed through repository-embedded media files,
- seeding is replaced by a dedicated data provisioning pipeline,
- request-bound seed execution is removed entirely,
- or demo seed requirements are retired.

## Deprecated (Optional)

Not deprecated.

## Superseded by (Optional)

Not superseded.
