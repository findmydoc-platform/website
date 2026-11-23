# Testing Guide

Use this folder as the entry point for our Payload/Next testing story. Each page keeps the language light so you can scan, dive into code, and ship.

## Run Commands

```bash
pnpm tests                 # full suite
pnpm tests --project=unit
pnpm tests --project=integration
pnpm tests --coverage
pnpm tests --watch         # iterate locally
```

Notes about logs and verbosity:

- Tests are intentionally quiet by default to reduce CI noise. The test harness silences `console.*` via `tests/setup/silenceLogs.ts`.
- To run tests and show logs locally, use:

```bash
pnpm tests:show-logs
# or
TEST_SHOW_LOGS=1 pnpm tests --project=integration
```

- Payload logger behavior in tests is fixed by runtime policy (`test` defaults to `error`).

## Read Me Next

- [Setup & Environment](./setup.md) — tooling, env vars, and the global database lifecycle
- [Testing Strategy](./strategy.md) — what we cover, how we prioritise, and when to add new suites
- [Access Control](./access-control.md) — keeping collections aligned with the permission matrix
- [Patterns & Utilities](./patterns.md) — helpers, fixtures, and reuse guidance

## Repository Layout

All tests live under `tests/`:

- `tests/unit/access` — standalone access utilities
- `tests/unit/collections` — collection configs aligned with the permission matrix metadata
- `tests/unit/hooks`, `tests/unit/auth`, `tests/unit/helpers` — domain-specific logic and shared mocks
- `tests/integration` — payload + supabase flows with controlled fixtures
- `tests/setup` — global setup scripts (Docker lifecycle, Vitest glue)

## Coverage

Vitest applies [per-suite thresholds](../../config/coverage) through [its configuration](../../vitest.config.ts).
See [CI results and full integration](./strategy.md#ci-results-and-full-integration) for full and partial coverage
rules and how to read Combined Coverage.

## Shared Expectations

- Use `overrideAccess: true` when writing setup data so tests focus on the logic under inspection.
- Clean fixtures in reverse order (children before parents) to keep the database tidy.
- Let the provided setup scripts manage Docker containers; no manual compose commands are required.
