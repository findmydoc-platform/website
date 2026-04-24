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

## Admin Journey Validation

- Treat `tests/e2e/helpers/adminJourneys/**`, `tests/e2e/helpers/adminFixtures.ts`, `tests/e2e/helpers/adminSession.ts`, `tests/e2e/helpers/adminUI.ts`, `tests/e2e/setup/**`, `scripts/playwright-session*.ts`, and `scripts/playwright-journey-capture.ts` as shared admin-journey infrastructure.
- When shared admin-journey infrastructure changes, run the smallest local Playwright lane that proves the affected consumer behavior instead of stopping at unit tests.
- Run `pnpm tests:e2e:smoke:admin` for platform-admin auth, reachability, or small CRUD journey changes.
- Run `pnpm tests:e2e:regression:admin` for shared step plumbing, clinic-staff flows, persona/session changes, fixture provisioning changes, or longer dependent admin chains.
- Run `pnpm playwright:journey:capture -- --journey <id> --persona <admin|clinic>` when checkpoint metadata, guide-capture behavior, or screenshot sequencing changes.
- If a change affects both smoke and regression consumers, run both lanes and state which journey ids or specs were exercised in the handoff.
