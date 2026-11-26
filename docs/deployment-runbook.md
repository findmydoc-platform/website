# Deployment & Migration Runbook

## Goal

Keep schema changes safe and repeatable across local development, preview, and production without destructive resets.

## Core Policy

- All shared schema changes must be committed as Payload migrations in `src/migrations/**`.
- `migrate:fresh` is allowed only for local disposable/test databases.
- Preview and production move forward only through the guarded migration helper with `DATABASE_DIRECT_URI`.
- Vercel runtime uses only the transaction-pooled `DATABASE_URI`; the operations URL must not enter Vercel runtime or build
  environments.
- Long-running seed operations should run through the Developer Dashboard job queue, not request-bound runtime execution.

## When Migrations Run

1. **DB Quality workflow (GitHub Actions)**
   DB Quality starts a local Postgres service, applies migrations, and runs `pnpm payload migrate:status` when DB-relevant files changed.

2. **Pull Request build job (GitHub Actions)**
   The build job starts a local Postgres service and prepares a disposable build database before `pnpm build`. Migration status and schema/migration enforcement live in DB Quality.

3. **Preview deployment (GitHub Actions and Vercel)**
   The GitHub `Preview` environment supplies `DATABASE_DIRECT_URI` while `vercel build --target preview` runs on the
   GitHub runner. The build command applies the guarded migration and builds the application. GitHub then deploys only
   the prebuilt artifact to Vercel. The operations URL is not forwarded as a Vercel runtime or build variable.

4. **Production deployment (GitHub Actions and Vercel)**
   The configured Production release path is the joint Website and Clinic Dashboard platform release. Ops owns the
   operator procedure in the [internal platform release runbook](https://github.com/findmydoc-platform/ops/blob/main/docs/platform-release.md).
   The [Website release caller](../.github/workflows/platform-release-deploy.yml) accepts the frozen Website commit
   as `target_sha`, the shared version as `platform_version`, and the frozen release plan digest as `plan_digest`.
   Dispatch is restricted to the findmydoc Platform Release GitHub App. The caller invokes the reusable Production
   workflow pinned to an exact commit SHA.

   That workflow uses the GitHub `Production` environment, builds on the GitHub runner, deploys the prebuilt artifact
   to Vercel, and includes an alias step for `findmydoc.eu`. `DATABASE_DIRECT_URI` is supplied only to the guarded
   migration/build process on the runner; it is not forwarded as a Vercel build or runtime variable.

   These sources establish the configured workflow only. Each operational claim needs separate evidence:

   | Claim | Required evidence |
   | --- | --- |
   | Workflow configured | The caller and the reusable workflow at its exact pinned commit. |
   | Deployment completed successfully | A successful deployment run tied to the frozen SHA, shared version, and deployment. |
   | Domain routing active | A timestamped check that the domain routes to the intended deployment. |
   | Application operating correctly | Timestamped observations of the expected version and relevant application flows. |

   Workflow configuration alone does not verify a successful deployment, active domain routing, or observed operation.

5. **Deployment metadata contract**
   `DEPLOYMENT_ENVIRONMENT` is the single server-side deployment variable used by runtime checks and diagnostics.
   Preview delivery and the pinned Production reusable workflow supply it during build and as a deployment runtime
   override. `VERCEL_ENV` remains the independent hosting check. Local profiles use `development`; the public seeding
   label `NEXT_PUBLIC_DEPLOYMENT_ENV` remains separate. Notification capture still requires its explicit activation.

   The deployment boundary validates the target environment, full commit SHA, and production release version before
   calling Vercel. Its controlled Vercel-stub test verifies the build and runtime values actually passed to the CLI;
   it is not a replacement for validating a real Preview deployment.

## Reserve the shared Preview alias

The Website Preview workflow deploys immutable Preview URLs for trusted changes. A push to `main` also assigns
`preview.findmydoc.eu` unless the repository variable `PREVIEW_ALIAS_RESERVATION` is nonempty. The GitHub deployment
Environment URL always identifies the immutable deployment; its summary reports whether the shared alias changed.
Production and other CI workflows do not read this reservation.

For acceptance that requires a fixed Website/Dashboard pair:

1. Set the Website repository variable to a non-secret purpose, issue reference, and qualified deployment ID, for example:
   `gh variable set PREVIEW_ALIAS_RESERVATION --repo findmydoc-platform/website --body 'group-access #2182; dpl_example'`.
2. Wait for already queued/running Preview workflows to finish. Repository variables are captured by workflow runs;
   setting a reservation does not retroactively stop an older run from assigning the alias.
3. Assign the approved Website deployment with the named account profile:
   `vercel-findmydoc alias set <qualified-deployment-url> preview.findmydoc.eu --scope findmydoc`.
   Verify the alias target and runtime revision alongside the Dashboard target before collecting acceptance evidence.
4. Leave the reservation in place during acceptance. New immutable deployments continue normally, including those on
   `main`; their summaries report that the shared alias is reserved. Assign replacement qualified deployments explicitly.
5. After acceptance, delete the reservation with
   `gh variable delete PREVIEW_ALIAS_RESERVATION --repo findmydoc-platform/website`.
   The next successful push deployment from `main` resumes automatic alias assignment. Deletion alone does not move it.

## Developer Workflow for Schema Changes

1. Change schema-related code (`src/collections/**`, `src/globals/**`, etc.).
2. Generate migration: `pnpm payload migrate:create <name>`.
3. Apply locally: `bash .codex/scripts/payload-migration.sh migrate`.
4. Verify: `bash .codex/scripts/payload-migration.sh migrate:status`.
5. Commit schema and migration files together.
6. Open PR and wait for CI gates.

## Production-Safe Schema and Data Changes

Use an expand/backfill/switch/contract flow for changes that rename fields, move data, harden constraints, or remove data.

1. **Expand**: add the new field, table, relation, or nullable/defaulted constraint without removing the old shape.
2. **Backfill**: copy or transform existing data with an idempotent migration or operator script. Re-running the backfill must not corrupt data.
3. **Switch**: update application reads and writes to prefer the new shape. Keep compatibility with the old shape until the active deployment no longer depends on it.
4. **Contract**: remove the old field, table, fallback, or data only in a later release after production has run successfully on the new shape.

Rules:

- Treat field renames as `add new field -> backfill -> switch reads/writes -> drop old field`.
- Introduce required fields as nullable or defaulted first, backfill them, verify null counts, and harden the constraint later.
- Keep destructive SQL (`DROP COLUMN`, `DROP TABLE`, `TRUNCATE`, `DELETE FROM`) out of the first release that introduces replacement storage.
- Document before/after counts for backfills and destructive cleanup.
- Confirm backup / point-in-time recovery before any contract-stage migration that removes production data.
- Before approving a contract migration, verify the running application no longer depends on the removed storage and
  rehearse against a disposable restore. After migration, use a compatible application version. If rollback requires
  deleted data, recover it from the pre-migration backup or roll forward.
  [Search removal example](https://github.com/findmydoc-platform/website/pull/1799)
- Prefer soft-delete or archival states before hard deletion when business data may still be needed.

Production data checks:

- CI must not query production databases.
- Use a backup restore, snapshot, or read replica as the default source for production-shape verification.
- Direct production reads are an exception and require a technically read-only role, bounded `SELECT` queries, and a documented migration decision.

## CI Guardrails

- If schema-related files changed but no migration files were committed, CI runs a Payload alignment check.
- If Payload can generate a migration, CI fails until migration files are committed.
- This catches “forgot migration” issues before preview/production deploys.
- The **DB Quality** workflow always runs a required gate job, while heavy migration checks run only for DB-relevant changes.
- DB Quality applies migrations to a local CI Postgres instance and runs `pnpm payload migrate:status`.
- The advisory migration risk scan warns on destructive or compatibility-sensitive SQL patterns; warnings do not block merges until the policy is intentionally tightened.

## Database Connection Boundary

Application runtime and operational database work use separate connection modes:

- `DATABASE_URI` is the Website runtime connection. On Vercel it must use the Supabase transaction pooler on port
  `6543`.
- `DATABASE_DIRECT_URI` is available only to migrations, backups, and focused database tools.
- The guarded helper sets `PAYLOAD_DATABASE_OPERATION=migration` only in its child process so Payload config accepts
  the operations connection. Do not persist this internal marker in GitHub or Vercel environment configuration.
- Hosted migration commands stop before Payload starts when the operations variable is missing. Local and local-Postgres CI
  commands may use `DATABASE_URI` as a documented fallback.
- Never copy either URL into logs, command arguments, tickets, screenshots, or documentation.

See [Database Runtime Connections](./engineering/database-runtime-connections.md) and
[ADR 027](./adrs/027-adr-database-runtime-connection-modes.md) for the topology, failure contract, and Preview release
boundary.

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

- Baseline is allowed in all runtimes.
- Demo is blocked in production.
- Baseline reset is blocked in production.
- Demo reset is blocked in production.

Endpoint note:
- `POST /api/seed` is the dashboard entrypoint and is available to platform users in `development`, `test`, `preview`, and `production`.
- `GET /api/seed` restores the run snapshot from the server; `GET /api/seed?runId=...` is the exact-run lookup used after reload.

## Next.js 16.2 / Turbopack Incident (March 20, 2026)

Vercel deployments built with Turbopack failed at request time with
`An error occurred while loading the instrumentation hook` and `ERR_REQUIRE_ESM`. The runtime tried to load the
generated ESM instrumentation file with `require()`. Webpack builds avoided this failure. A successful build alone
does not exercise the affected routes.

Keep `next build --webpack` for deployed builds under [ADR 024](./adrs/024-adr-production-build-webpack-fallback.md).
Before removing the fallback, verify a stable Next.js release with at least three consecutive Preview and Production
deployments free of instrumentation errors. Exercise `/admin/login`, `/admin`, and the affected `/api/auth/**` routes
under real Preview traffic. Record deployment IDs, timestamps, and route checks in
[rollback issue #777](https://github.com/findmydoc-platform/website/issues/777). If a relevant Next.js upgrade changes
the runtime path, rerun qualification. If the same error recurs, update the
[Next.js instrumentation issue](https://github.com/vercel/next.js/issues/78705) and open a Vercel support ticket.

The original incident details and config changes are in the
[frozen incident runbook](https://github.com/findmydoc-platform/website/blob/96a76e77d4b1c2755cc7a1af92220639bd52ea4c/docs/deployment-runbook.md#nextjs-162--turbopack-incident-march-20-2026).
