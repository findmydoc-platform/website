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
```

CI pipelines provide their own secrets; local developers can reuse the defaults from `.env.example` where practical.

### Logging Configuration

Control test output verbosity with these optional environment variables in `.env.test`:

```
# Set log level: 'silent', 'error', 'warn', 'info', or 'debug'
PAYLOAD_LOG_LEVEL=error

# Suppress hook info logs (e.g., "Updating average price after...") during tests
SUPPRESS_HOOK_LOGS=true
```

**Recommendations:**
- **Integration tests**: Use `PAYLOAD_LOG_LEVEL=error` and `SUPPRESS_HOOK_LOGS=true` to reduce noise and focus on test results
- **Debugging failures**: Temporarily set `PAYLOAD_LOG_LEVEL=debug` and `SUPPRESS_HOOK_LOGS=false` to see detailed hook execution
- **CI/CD**: Keep logs minimal (`error` level) to make build output readable

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
