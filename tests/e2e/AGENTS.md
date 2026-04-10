# E2E Test Rules

## Priorities

- `P0`: Deterministic user-facing behavior over implementation detail coverage.
- `P1`: Stable admin smoke coverage for auth, navigation, and critical CRUD.
- `P2`: Readable Playwright helpers with minimal hidden magic.

## Critical Rules

- Use Playwright for `tests/e2e/**`.
- Test real user flows and visible outcomes, not Payload internals.
- Prefer selectors based on role, label, and visible text; use structural locators only when the accessible surface is insufficient.
- Reuse shared setup and `storageState`; do not repeat login in every test unless login itself is the subject.
- Keep artifacts under `output/playwright/**`.
- Keep smoke coverage small, deterministic, and serial by default.
- The standard admin smoke lane expects an existing Supabase test admin via `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD`; do not provision or delete auth users from Playwright tests.
- If a test needs seeded domain data, create it explicitly and clean it up through the shared DB harness or test teardown.
