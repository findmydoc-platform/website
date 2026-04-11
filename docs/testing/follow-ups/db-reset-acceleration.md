# DB Reset Acceleration Follow-up

Status: planned (post E2E rollout)

## Problem

Integration and E2E runs currently reset the database by:

1. `docker compose down -v`
2. `docker compose up -d`
3. `payload migrate:fresh`

This is robust but expensive for repeated local and CI runs.

## Goal

Reduce end-to-end test startup time without sacrificing deterministic isolation.

## Candidate Approaches

1. Fast run reset without full container teardown
- Keep Postgres container running across test runs.
- Replace `down -v` with schema/database truncation and controlled reseed.
- Keep `migrate:fresh` only when schema drift is detected.

2. Snapshot/template strategy
- Prepare a migrated baseline DB template once per job.
- Clone/reset from template before each integration/E2E run.
- Seed only test-specific deltas.

3. Hybrid
- Default to fast reset.
- Fallback to full reset when integrity checks fail.

## Constraints

- Must keep deterministic tests (no state leakage between runs).
- Must work for both `tests/integration` and Playwright E2E harness.
- Must remain compatible with current seed flow (`pnpm run seed:run -- --type baseline --runtime-env test`).

## Acceptance Criteria

- Median startup time reduced by at least 40% versus current baseline.
- No increase in flaky failures over at least 20 consecutive CI runs.
- One shared reset abstraction reused by integration and E2E harnesses.

## Proposed Execution

1. Measure current baseline timings in CI and local runs.
2. Implement fast-reset prototype behind a toggle.
3. Validate determinism and flake rate.
4. Switch default after evidence threshold is met.
