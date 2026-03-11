# ADR: Consolidated Seed Runner and Manual Seed Pipeline

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 1.1 |
| Date | 11.03.2026 |
| Status | accepted |

## Background

Seed data is currently executed through local scripts and a request-bound `/api/seed` endpoint.
In the current hosting setup, preview runs on Vercel free-tier constraints where request-bound execution is terminated after 60 seconds.
During media-heavy seed runs, this leads to runtime failures with `task timed out after 60 seconds`, even when the underlying seed logic is correct.

## Problem Description

We need a consistent, policy-safe way to execute baseline and demo seeds across local development and CI/CD environments.
The solution must avoid Vercel free-tier 60-second request timeouts for long-running media uploads, preserve production safety rules, and minimize structural churn in existing seed assets.

## Considerations

1. Keep multiple dedicated local scripts (`seed:baseline`, `seed:demo`, reset variants)
   - Pros: no immediate command changes
   - Cons: duplicated orchestration and policy logic; higher drift risk between local and automation paths

2. Use endpoint-only seeding from automation (`/api/seed`)
   - Pros: no CLI changes
   - Cons: still request-bound and therefore fails under Vercel free-tier 60-second timeout for media-heavy runs

3. Consolidate to one CLI runner and execute automation through that runner (chosen)
   - Pros: single source of truth for seed orchestration and environment policy; avoids Vercel request timeout limits by running out-of-band; same behavior locally and in workflows
   - Cons: breaking command change for local users; introduces an additional operational workflow

## Decision with Rationale

We consolidate seed execution to a single CLI command (`pnpm seed:run`) and add a dedicated manual GitHub workflow (`.github/workflows/seed.yml`) that invokes the same command.
The operational trigger for this decision is the Vercel free-tier runtime limit (60 seconds) combined with media upload duration during seed execution.

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
