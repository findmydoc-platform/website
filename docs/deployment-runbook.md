# Deployment & Migration Runbook

## Goal

Keep schema changes safe and repeatable across local development, preview, and production without destructive resets.

## Core Policy

- All shared schema changes must be committed as Payload migrations in `src/migrations/**`.
- `migrate:fresh` is allowed only for local disposable/test databases.
- Preview and production move forward only with `pnpm payload migrate`.
- Long-running seed operations should run through the Developer Dashboard job queue, not request-bound runtime execution.

## When Migrations Run

1. **Pull Request build job (GitHub Actions)**  
   The build job starts a local Postgres service, applies migrations, and runs `pnpm payload migrate:status`.

2. **Preview deployment (Vercel)**  
   Vercel executes `pnpm run ci` via `vercel.json`.  
   `pnpm run ci` runs `pnpm run migrate` before `pnpm build`.

3. **Production deployment (Vercel)**  
   Same as preview: `pnpm run ci` runs migrations before the build.

## Developer Workflow for Schema Changes

1. Change schema-related code (`src/collections/**`, `src/globals/**`, etc.).
2. Generate migration: `pnpm payload migrate:create <name>`.
3. Apply locally: `pnpm payload migrate`.
4. Verify: `pnpm payload migrate:status`.
5. Commit schema and migration files together.
6. Open PR and wait for CI gates.

## CI Guardrails

- If schema-related files changed but no migration files were committed, CI runs a Payload alignment check.
- If Payload can generate a migration, CI fails until migration files are committed.
- This catches “forgot migration” issues before preview/production deploys.

## Incident/Emergency Rules

- Do not fix production schema drift with `migrate:fresh`.
- Use forward migrations for fixes.
- Ensure database backup / point-in-time recovery is available before production deploys.
- If preview must be reset in an emergency, use the manual **Reset Database** workflow (Preview only).

## Seed Operations Runbook

Use the Developer Dashboard to start baseline or demo runs.

Flow:

1. A platform user clicks **Seed Baseline** or **Seed Demo** in the Developer Dashboard.
2. `POST /api/seed` queues a run and stores the run snapshot under a generated `runId`.
3. The dashboard stores only `runId` locally and restores the exact run from the server after reload.
4. Payload jobs process the queued work in the background until the run reaches a terminal state.

Policy guardrails:

- Baseline is allowed in preview and production.
- Demo is blocked in production.
- Reset is blocked in production.

Endpoint note:
- `POST /api/seed` is the dashboard entrypoint and is enabled only in `development`, `test`, and `preview`.
- `GET /api/seed` restores the run snapshot from the server; `GET /api/seed?runId=...` is the exact-run lookup used after reload.

## Next.js 16.2 / Turbopack Incident (March 20, 2026)

### Observed Failure Modes

1. **Runtime crash on Vercel (`ERR_REQUIRE_ESM`)**
   - Error shape:
     - `An error occurred while loading the instrumentation hook`
     - `require() of ES Module /var/task/.next/server/instrumentation.js ... not supported`
   - Seen on `website` preview/production deployments built with Next.js `16.2.0 (Turbopack)`.

2. **Invalid Next config warning**
   - `experimental.isolatedDevBuild` became invalid after Next.js `16.2.0`.

3. **Separate non-Turbopack errors during recovery**
   - `missing secret key` (missing/incorrect `PAYLOAD_SECRET` in `website` preview envs).
   - `Could not load the "sharp" module using the linux-arm64 runtime` (macOS prebuilt artifact deployed to Linux runtime).

### Why This Surfaced Now

- The app runs with `"type": "module"` and uses `src/instrumentation.ts`.
- With Next.js `16.2.0`, production builds defaulted to Turbopack in our deploy path.
- On Vercel runtime, the launcher attempted a CommonJS `require()` path for generated `instrumentation.js`, which failed in ESM mode (`ERR_REQUIRE_ESM`).
- This crash is independent from `PAYLOAD_SECRET` and `sharp` errors, which happened later during mitigation and had different signatures.

### Applied Mitigation

- Force webpack for production builds:
  - `package.json` -> `build`: `next build --webpack`
- Remove unsupported config:
  - `next.config.js` -> remove `experimental.isolatedDevBuild`
- Stop tracking generated Next typing artifact:
  - add `next-env.d.ts` to `.gitignore`
  - run `next typegen` explicitly in `pnpm check`

### Revert Plan (Re-enable Turbopack)

Only revert the webpack fallback when all conditions are met:

1. A stable Next.js release demonstrably fixes the instrumentation ESM runtime path on Vercel.
2. `website` preview and production pass at least 3 consecutive deployments without instrumentation-hook runtime errors.
3. No regression in Payload admin routes (`/admin/login`, `/admin`, API auth routes) under real preview traffic.

### ADR Decision

- **No ADR yet**: current change is a tactical stability workaround and fully reversible.
- Create an ADR if webpack fallback becomes long-lived (for example, spans multiple release cycles) or we intentionally standardize away from Turbopack.
