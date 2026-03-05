# Deployment & Migration Runbook

## Goal

Keep schema changes safe and repeatable across local development, preview, and production without destructive resets.

## Core Policy

- All shared schema changes must be committed as Payload migrations in `src/migrations/**`.
- `migrate:fresh` is allowed only for local disposable/test databases.
- Preview and production move forward only with `pnpm payload migrate`.

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
