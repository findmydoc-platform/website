---
applyTo: "tests/**/*.ts,tests/**/*.tsx"
---

# Tests in this repo

- Test runner: Vitest only.
- Test locations: all tests live under `tests/**`, not beside source files.
- Priorities: access control, auth, and hooks tests are most important; follow existing patterns under `tests/unit/access/**` and `tests/unit/helpers/**`.
- Use existing helpers like `mockUsers` and `createMockReq` from `tests/unit/helpers` when testing access and auth.
- Prefer `test.each` tables for role matrices and explicit shape assertions for scoped filters.
- Do not introduce Jest, Mocha, or React Testing Library unless you find existing usage here to follow.
- Avoid testing Payload internals or generated types; focus on our access utilities, hooks, and custom logic.
