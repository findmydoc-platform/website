# Testing Setup

Keep this page handy when preparing your local environment or CI jobs to run the test suite.

## Prerequisites

- Node.js 24.x
- pnpm 10+
- Docker Desktop (used for the isolated Postgres instance)

## Environment Variables

Create `.env.test` at the workspace root. Minimum values:

```bash
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc-test
PAYLOAD_SECRET=test-secret-key-for-jwt
NEXT_PUBLIC_SERVER_URL=http://localhost:3000
PREVIEW_SECRET=test-preview-secret
```

Test mode guidance:
- Tests should default to local Postgres and local storage.
- Do not enable development S3 in tests (`USE_S3_IN_DEV` should remain unset or `false`).
- If a test scenario needs Supabase endpoints, use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- The Playwright admin smoke lane additionally expects `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` for an already existing Supabase platform admin account.
- Do not put blank `E2E_ADMIN_*` values into `.env.test`; that file overrides `.env.local` during test startup.

A couple of notes about logging and test-time behavior:

- By default tests are run quietly (console output is silenced) to keep CI logs readable. This is implemented via `tests/setup/silenceLogs.ts` which is loaded by Vitest `setupFiles`.
- To view logs for a local run, either set `TEST_SHOW_LOGS=1` in the environment, or use the provided package script `pnpm tests:show-logs` which sets the var for you.
- Payload logger level for tests is fixed by runtime policy (`test` => `error`).

CI pipelines provide their own secrets; local developers can reuse the defaults from `.env.example` where practical.

## Running the Suite

```bash
pnpm tests                  # run all Vitest suites
pnpm tests --project=unit    # unit only
pnpm tests --project=integration
pnpm tests:e2e:smoke         # Playwright admin smoke suite
pnpm tests:e2e               # full Playwright E2E suite
pnpm tests:e2e:headed        # visible browser for local diagnosis
pnpm tests:e2e:debug         # Playwright inspector / PWDEBUG
pnpm tests --coverage
pnpm tests --watch           # iterative feedback
```

Use `pnpm tests --inspect-brk` for debugging with breakpoints.

## Global Infrastructure

`tests/setup/integrationGlobalSetup.ts` controls the database lifecycle:

1. Launch the Postgres container defined in `docker-compose.test.yml`
2. Apply migrations
3. Execute the test target
4. Tear down the container

You do not need to run Docker commands manually; the setup script handles it.

The Playwright lane uses the same Docker + migration harness via `scripts/test-database-harness.mjs` and starts a local app server through `scripts/e2e-server.mjs`. This keeps integration and E2E on one reset path instead of duplicating infrastructure.

## Playwright E2E Setup

- The Playwright config lives in `playwright.config.ts`.
- Artifacts are written to `output/playwright/**`.
- The admin smoke suite logs in with fixed environment credentials, records session state in `output/playwright/sessions/admin.e2e.json`, and expects the Supabase admin account to exist already.
- The smoke lane does not check whether that Supabase admin exists and does not provision or clean it up. If the account is missing or invalid, the login test fails immediately.
- In `test` runtime, `/admin/login` stays reachable even after a fresh Payload DB reset so the first successful Supabase login can recreate the CMS-side admin records.
- For admin E2E, you must provide:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
- By default Playwright starts its own local stack on `http://localhost:3100`. To target an already running instance instead, set `PLAYWRIGHT_BASE_URL`. To change the local port, set `E2E_PORT`.
- CI uses the dedicated GitHub Actions workflow `.github/workflows/admin-e2e-smoke.yml`, triggered on `push` to `main` and `workflow_dispatch`. Store `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` in the protected `admin-e2e-smoke` environment.

## Practical Notes

- Always pass `overrideAccess: true` when seeding data inside tests so the collection access rules do not interfere with setup.
- Clean up records in reverse dependency order (e.g. treatments before clinics) to avoid foreign key errors.
- Send a `req` object to access functions and hooks via `createMockReq` from `tests/unit/helpers/testHelpers.ts`.
- Prefer fixtures in `tests/fixtures` for integration data; they mirror the production seed shapes and include cleanup helpers.

## Follow-up

After the first Playwright rollout lands, the next infrastructure improvement should target DB reset speed. The current path still performs full container teardown plus `migrate:fresh`; the follow-up should evaluate a faster run reset or a snapshot/template database approach once the new E2E lane is stable.
