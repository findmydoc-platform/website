# Test Rules

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

- Prefer behavior contracts over implementation mirrors. Remove tests that only repeat constants, classes, or markup fragments; retain explicit technical configuration and data contracts where the values determine behavior.
- Keep product coverage honest: tooling and data-integrity tests must not inflate app unit coverage.
- For AI-generated tests, reject green tests that define their own subject under test, assert values assigned in the test body, or verify mocked child props without a product-facing behavior.
- When behavior is removed, delete obsolete tests without replacing them with absence-only tests; cover the surviving behavior and explicit acceptance criteria.
- Use `pnpm tests:sense-check` after adding or moving tests; hard failures are structure problems, warnings need reviewer judgment.

## Editorial copy

- Production editorial wording must never be the expected behavior asserted by a test.
- Do not freeze production headings, descriptions, marketing copy, consent explanations, disclaimers, or translations through exact strings, sentence fragments, regular expressions, snapshots, hashes, or duplicated language catalogs. Moving these assertions into fixtures, data-integrity tests, or Storybook does not make them valid.
- Test observable behavior: use test-owned input text to prove rendering, normalization, metadata propagation, and locale selection or fallback. For fixed production copy, test the relevant structure, accessibility, links, or interaction without prescribing its wording. Delete copy-only assertions when no behavior remains to test.
- Do not replace a wording assertion with an import of the same production constant, a shorter keyword check, or a mock that only returns its own expected value.
- Exact text is valid for test-owned inputs, machine-readable contracts, and frozen historical migration data whose identity controls migration behavior. Accessible names used to perform real interactions are valid selectors; asserting unrelated default prose is not.
- Before finishing, identify the behavior each changed test protects. Remove assertions whose only purpose is to freeze production editorial wording.
