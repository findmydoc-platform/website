---
applyTo: 'tests/**/*.ts,tests/**/*.tsx'
---

# Test Rules

## Priorities

- `P0`: Deterministic, behavior-focused tests.
- `P1`: Coverage for access control, auth, and hooks.
- `P2`: Readable, maintainable test structure.

## Critical Rules

- Use Vitest only.
- Keep tests under `tests/**`.
- Prefer existing helpers (`mockUsers`, `createMockReq`) for auth/access scenarios.
- Use table-driven tests for role matrices and explicit shape assertions for scoped filters.
- Stub only the dependency surface needed by the test.
- Avoid testing Payload internals or generated types.
- When running unit, integration, or Storybook suites locally, exercise only the tests that cover the files you changed (e.g., `pnpm vitest tests/unit/foo.spec.ts`); rely on the pipeline for the remaining coverage.
