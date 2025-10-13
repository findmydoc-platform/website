# Testing Setup

Keep this page handy when preparing your local environment or CI jobs to run the test suite.

## Prerequisites

- Node.js 18+
- pnpm 8+
- Docker Desktop (used for the isolated Postgres instance)

## Environment Variables

Create `.env.test` at the workspace root. Minimum values:

```
DATABASE_URI=postgresql://postgres:password@localhost:5433/findmydoc_test
PAYLOAD_SECRET=test-secret-key-for-jwt
SUPABASE_URL=<test-supabase-url>
SUPABASE_ANON_KEY=<test-anon-key>
SUPABASE_JWT_SECRET=<test-jwt-secret>

A couple of notes about logging and test-time behavior:

- By default tests are run quietly (console output is silenced) to keep CI logs readable. This is implemented via `tests/setup/silenceLogs.ts` which is loaded by Vitest `setupFiles`.
- To view logs for a local run, either set `TEST_SHOW_LOGS=1` in the environment, or use the provided package script `pnpm tests:show-logs` which sets the var for you.
- Payload's logger level is controlled by the `PAYLOAD_LOG_LEVEL` env var. If unset, the system defaults to `error` to avoid noisy info/debug logs during tests. Set `PAYLOAD_LOG_LEVEL=info` if you need more verbose payload logging locally.
```

CI pipelines provide their own secrets; local developers can reuse the defaults from `.env.example` where practical.

## Running the Suite

```bash
pnpm tests                  # run everything
pnpm tests --project=unit    # unit only
pnpm tests --project=integration
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

## Practical Notes

- Always pass `overrideAccess: true` when seeding data inside tests so the collection access rules do not interfere with setup.
- Clean up records in reverse dependency order (e.g. treatments before clinics) to avoid foreign key errors.
- Send a `req` object to access functions and hooks via `createMockReq` from `tests/unit/helpers/testHelpers`.
- Prefer fixtures in `tests/fixtures` for integration data; they mirror the production seed shapes and include cleanup helpers.
