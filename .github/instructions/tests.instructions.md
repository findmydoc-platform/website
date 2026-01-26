---
applyTo: 'tests/**/*.ts,tests/**/*.tsx'
---

# Tests in this repo

- Test runner: Vitest only.
- Test locations: all tests live under `tests/**`, not beside source files.
- Priorities: access control, auth, and hooks tests are most important; follow existing patterns under `tests/unit/access/**` and `tests/unit/helpers/**`.
- Use existing helpers like `mockUsers` and `createMockReq` from `tests/unit/helpers` when testing access and auth.
- Prefer `test.each` tables for role matrices and explicit shape assertions for scoped filters.
- Do not introduce Jest, Mocha, or React Testing Library unless you find existing usage here to follow.
- Avoid testing Payload internals or generated types; focus on our access utilities, hooks, and custom logic.
- **Partial Mocking**: When mocking complex objects, stub only the properties needed for the test. Do not attempt to replicate the full implementation of external dependencies.

- **Keep tests focused**: Test a single behavior per test so failures are easy to diagnose and fix. Prefer one expectation per test when practical; use `test.each` or multiple tests for related permutations.

- **Where tests should live** (use existing folders):
  - `tests/unit`: Unit tests for access control, hooks, small helpers, and collection-level logic (fast, isolated).
  - `tests/integration`: Integration or route-level tests that exercise multiple components together (API endpoints, end-to-end flows); stub external services and keep them focused.
  - `src/stories`: Storybook stories and visual/interactive examples; use stories for component demos and visual regression; if you need automated checks for stories prefer Storybook play functions or Chromatic rather than cramming unit tests into stories.
