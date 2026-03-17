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
