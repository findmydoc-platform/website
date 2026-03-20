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

### Upstream Changes Relevant to This Incident

- `next build` uses Turbopack by default in Next.js 16; webpack is opt-in via `--webpack`.
- `experimental.isolatedDevBuild` was removed (reason from Next.js PR #89167: the behavior is now default, with separate dev/build output locations).
- Result: after upgrading to `16.2.0`, two things can happen at once:
  - an expected config warning for the removed flag,
  - and a separate runtime regression in the Turbopack instrumentation path.

### Root Cause (Runtime Failure)

- The app is ESM (`"type": "module"`) and uses `src/instrumentation.ts`.
- In failing Turbopack deployments, Vercel/Next runtime startup attempted to load `.next/server/instrumentation.js` via `require()`.
- In an ESM package scope, that load path can fail with `ERR_REQUIRE_ESM`, which aborts instrumentation initialization and breaks affected dynamic routes (for example `/admin/login`).
- This error pattern is not unique to this repository; a similar Turbopack + instrumentation `ERR_REQUIRE_ESM` incident is documented upstream in Next.js issue #78705.

Important:
- The `isolatedDevBuild` warning is **not** the runtime crash root cause.
- Removing that flag fixes config validation noise only.

### Why `--webpack` Fixed It

- Webpack and Turbopack generate and bootstrap server runtime artifacts differently.
- In our deploys, the Turbopack runtime path hit the instrumentation load failure; webpack builds (`Next.js 16.2.0 (webpack)`) did not reproduce that signature.
- Therefore `next build --webpack` is a compatibility mitigation for this specific runtime path, while staying on Next.js `16.2.0`.

### Why It Could Appear “New” Between Releases

- The failure is request-time on server routes, not a compile-time hard stop.
- A deployment can look “green” until affected routes are hit, then fail with instrumentation-hook errors.
- This explains why one release can appear okay initially while a subsequent release quickly shows errors once traffic reaches those routes.
- Also, `v0.27.0` -> `v0.27.1` changed only dependency overrides/tests (no direct app-runtime logic changes), so timing and route coverage can change what is observed first.

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

### References

- Next.js CLI docs (`next build`: Turbopack default, `--webpack` override): https://nextjs.org/docs/app/api-reference/cli/next
- Next.js `v16.2.0` release notes (includes `IsolatedDevBuild flag removal`): https://github.com/vercel/next.js/releases/tag/v16.2.0
- Next.js PR #89167 (why `isolatedDevBuild` was removed): https://github.com/vercel/next.js/pull/89167
- Related upstream issue (`ERR_REQUIRE_ESM` in instrumentation with Turbopack): https://github.com/vercel/next.js/issues/78705

### Responsibility Matrix

- **Application team (`website`)**
  - Keep `next build --webpack` as the active mitigation until rollback criteria are met.
  - Keep `experimental.isolatedDevBuild` removed.
  - Monitor preview and production logs for instrumentation-hook regressions.
  - Maintain this runbook and the related tracking issue.

- **Next.js / Turbopack maintainers (upstream)**
  - Own stabilization of Turbopack instrumentation loading in ESM projects.
  - Own fixes for `ERR_REQUIRE_ESM`-class regressions in generated server runtime paths.

- **Vercel runtime/platform team (upstream)**
  - Own runtime-loader compatibility in Vercel server functions when Turbopack output is used.
  - Co-own fixes when failures are specific to Vercel deploy/runtime behavior.

### Escalation and Follow-Up

- Open/maintain a GitHub issue in this repository to track rollback readiness.
- If the same `ERR_REQUIRE_ESM` instrumentation signature reappears on current stable Next.js, open:
  - a Next.js upstream issue (or update existing upstream thread),
  - and a Vercel support ticket with affected deployment IDs and timestamps.
- Re-run rollback validation after each Next.js upgrade affecting Turbopack/runtime behavior.
