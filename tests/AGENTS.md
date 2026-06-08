# Test Rules

## Priorities

- `P0`: Deterministic, behavior-focused tests.
- `P1`: Coverage for access control, auth, and hooks.
- `P2`: Readable, maintainable test structure.

## Critical Rules

- Use Vitest for non-E2E tests; `tests/e2e/**` uses Playwright under its local `AGENTS.md`.
- Keep tests under `tests/**`.
- Use `tests/unit/**` for product runtime code and product configuration only.
- Use `tests/tooling/**` for delivery, repository automation, E2E support logic, and local developer tooling.
- Use `tests/data-integrity/**` for seed fixtures, static data contracts, and repository data consistency.
- Prefer existing helpers (`mockUsers`, `createMockReq`) for auth/access scenarios.
- Use table-driven tests for role matrices and explicit shape assertions for scoped filters.
- Stub only the dependency surface needed by the test.
- Avoid testing Payload internals or generated types.
- Do not test TypeScript interfaces, JavaScript language facts, local validators, local fixtures, or test-only helpers unless the helper is complex shared tooling with its own failure risk.
- Side-code tests are valid when the code makes decisions such as release versioning, PR gates, path relevance, deployment/session/database harness behavior, or data integrity rules.
- Every new test should be able to name the production, delivery, or data change that would make it fail.
- When running unit, integration, or Storybook suites locally, exercise only the tests that cover the files you changed (e.g., `pnpm vitest tests/unit/foo.spec.ts`); rely on the pipeline for the remaining coverage.

## Test Quality Playbook

- Prefer behavior contracts over implementation mirrors. If a test only repeats constants, classes, or markup fragments, move it to an explicit config/visual/data contract or remove it.
- Keep product coverage honest: tooling and data-integrity tests must not inflate app unit coverage.
- For AI-generated tests, reject green tests that define their own subject under test, assert values assigned in the test body, or verify mocked child props without a product-facing behavior.
- Use `pnpm tests:sense-check` after adding or moving tests; hard failures are structure problems, warnings need reviewer judgment.
