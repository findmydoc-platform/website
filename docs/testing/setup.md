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

## Collection Contract Gate

Integration coverage for collections is tracked via `tests/integration/contracts/collectionContractRegistry.ts`.

- The hard gate test `tests/integration/contracts/collectionContractCoverage.test.ts` compares real slugs from `src/collections/**` against the registry.
- It also verifies every registry entry points to real integration test files.
- New collections must be added to the registry in the same change set as their baseline integration test.
- Registry semantics:
  - `baseline` entries define the minimum contract references for a slug (privileged CRUD path + denied write expectation).
  - `deep` entries define additional references for relationship integrity, duplicate guards, and hook-driven side effects.
  - A test file can appear in both `baseline` and `deep` for one slug when the same suite covers both tiers.
- Recommended suite pattern:
  1. Use fixture/setup helpers to establish deterministic test data.
  2. Run `runBaselineContract` from `tests/integration/contracts/baselineContract.ts`.
  3. Add deep assertions for critical domain behavior in the same file or sibling files.
  4. Register all relevant file paths under the slug in `collectionContractRegistry.ts`.

Recommended focused run while iterating on this gate:

```bash
pnpm vitest --project integration --run tests/integration/contracts/collectionContractCoverage.test.ts
```

## Global Infrastructure

`tests/setup/integrationGlobalSetup.ts` controls the database lifecycle:

1. Launch or reuse the Postgres container defined in `docker-compose.test.yml`
2. Rebuild the shared test DB templates required by the current run only when they are missing, stale, or `TEST_DB_REBUILD_TEMPLATES=1`
3. Restore the working database from the selected template (`empty` for integration, `baseline` for Playwright E2E)
4. Execute the test target
5. Stop the container while preserving the Docker volume for the next warm run

You do not need to run Docker commands manually; the setup script handles it.

The Playwright lane uses the same Docker + template-clone harness via `scripts/test-database-harness.mjs` and starts a local app server through `scripts/e2e-server.mjs`. This keeps integration and E2E on one reset path instead of duplicating infrastructure.

Template fingerprints are derived per template kind. The `empty` template tracks `src/migrations/**` plus `src/payload.config.ts`, while the `baseline` template additionally tracks `src/endpoints/seed/**`.

Integration runs only require the `empty` template. Seed-only changes therefore rebuild `baseline` when needed without invalidating the `empty` integration template.

Set `TEST_DB_REBUILD_TEMPLATES=1` when you need a manual repair run that discards the preserved Docker volume and rebuilds the templates required by the current run from scratch. Other template kinds are rebuilt lazily on their next use.

## Playwright E2E Setup

- The Playwright config lives in `playwright.config.ts`.
- Artifacts are written to `output/playwright/**`.
- The admin smoke suite logs in with fixed environment credentials, records session state in `output/playwright/sessions/admin.e2e.json`, and expects the Supabase admin account to exist already.
- Current smoke coverage includes admin login, dashboard reachability, clinics create flow, and additional medical-network/content flows (medical specialties, doctor specialty relation, tags).
- The E2E harness restores the working database from the `baseline` template before starting `pnpm dev`; baseline seeding only runs again when that template is rebuilt.
- The smoke lane does not check whether that Supabase admin exists and does not provision or clean it up. If the account is missing or invalid, the login test fails immediately.
- In `test` runtime, `/admin/login` stays reachable even after a fresh Payload DB reset so the first successful Supabase login can recreate the CMS-side admin records.
- For admin E2E, you must provide:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `E2E_ADMIN_EMAIL`
  - `E2E_ADMIN_PASSWORD`
- By default Playwright starts its own local stack on `http://localhost:3100`. To target an already running instance instead, set `PLAYWRIGHT_BASE_URL`. To change the local port, set `E2E_PORT`.
- CI uses the dedicated GitHub Actions workflow `.github/workflows/admin-e2e-smoke.yml`, triggered on `pull_request` to `main`, `push` to `main`, and `workflow_dispatch`.
- Store `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the protected `admin-e2e-smoke` environment.
- The workflow uploads Playwright report/debug artifacts on every run and removes `output/playwright/sessions/**` before upload so session state never becomes a CI artifact.

## Practical Notes

- Always pass `overrideAccess: true` when seeding data inside tests so the collection access rules do not interfere with setup.
- Clean up records in reverse dependency order (e.g. treatments before clinics) to avoid foreign key errors.
- Send a `req` object to access functions and hooks via `createMockReq` from `tests/unit/helpers/testHelpers.ts`.
- Prefer fixtures in `tests/fixtures` for integration data; they mirror the production seed shapes and include cleanup helpers.
