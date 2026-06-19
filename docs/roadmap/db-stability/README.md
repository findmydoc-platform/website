# DB Stability and Schema Change Roadmap

This roadmap tracks the remaining high-impact database stability questions around schema changes, migrations, preview deployments, and production releases. It is intentionally scoped to risks above `7/10` severity. Smaller CI polish, naming cleanup, or style work belongs in normal issues, not here.

## Existing Guardrails

- DB Quality now follows the required-gate pattern: the workflow always runs, heavy checks run only for DB-relevant changes, and `db-quality-gate` is the only branch-protection candidate.
- Schema changes without committed migration files are blocked through the existing Payload migration generation check.
- Migration apply/status checks run against a fresh local Postgres service in CI.
- The migration risk scan is advisory and warns on destructive or compatibility-sensitive SQL patterns.
- `src/migrations/AGENTS.md` and `docs/deployment-runbook.md` already document expand -> backfill -> switch -> contract, no production reads from CI, and no production `migrate:fresh`.

## Scope Review

The current DB Quality work is useful and should remain small. It catches missing migrations, broken migration application, and required-check gaps before merge. Those are concrete failure modes and not speculative process.

Keep:

- The always-running `db-quality-gate` job. It solves the required-check problem without forcing heavy jobs for unrelated PRs.
- The shared change detector. It keeps DB-relevant path logic in one place for DB Quality and future DB-specific checks.
- Local migration apply/status checks. They are not production-grade validation, but they are a cheap correctness floor.
- The advisory risk scan as a review signal. It should stay advisory until the blocking rules are narrowed to a few high-confidence classes.
- The migration-local `AGENTS.md` and deployment runbook. They shift left human and AI behavior without adding runtime complexity.

Reduce or avoid:

- Do not build a generic policy-gate abstraction until at least one more workflow needs the exact same structure.
- Do not move database quality decisions back into `deploy.yml`. The build job may still prepare a disposable build database, but missing-migration enforcement, migration status, and risk scanning belong to DB Quality.
- Do not add production reads to CI. Production-shape validation should use a restored backup, snapshot, read replica, or database branch.
- Do not expand the risk scanner into a broad regex catalog. Add blocking rules only when they map to known production incident classes and have low false-positive rates.
- Do not treat the local fresh-DB migration job as proof of production safety. It proves migration executability, not production compatibility.

## Findings to Track

### 1. Production migrations run inside the Vercel build

Severity: `9/10`

Production deployment currently pulls Production Vercel environment variables and runs the Vercel production deploy. Vercel uses `pnpm run ci`, and `pnpm run ci` runs `pnpm run migrate` before `pnpm build`. That means production schema mutation happens as part of the build/deploy path, before the deployment alias is the only active production version.

Why it matters:

- If migration succeeds but build, deploy, or aliasing fails, the production database can be ahead of the running application.
- If a migration takes strong locks, live production traffic can block during a build step.
- Rollback is asymmetric: rolling app code back is easy, but rolling production data shape back may be impossible without data loss.
- DB Quality does not reduce this risk because it validates a local disposable database, not release orchestration against production.

Current evidence:

- `vercel.json` sets `buildCommand` to `pnpm run ci`.
- `package.json` defines `ci` as `pnpm run migrate && pnpm build`.
- `.github/workflows/deploy-production.yml` pulls Production Vercel env and delegates deploy to `.github/scripts/deploy/vercel-deploy.sh`.
- Payload migrations run within a transaction through Payload's migration runner.

Minimum next step:

- Split production migration execution from the Vercel build command, or introduce a guarded production migration step before aliasing with explicit backup/PITR readiness, timeout settings, and release compatibility checks.

Target shape:

1. Build deployable artifact without mutating the production database.
2. Run production migration step only after approval and preflight checks.
3. Use `lock_timeout` and `statement_timeout` for production DDL.
4. Apply only expand-stage migrations automatically.
5. Alias or promote the app after migration success.
6. Run contract-stage migrations in separate releases after compatibility evidence exists.

Open questions:

- Which system owns the migration step: GitHub Actions, Vercel deploy hook, or a manual operator workflow?
- Do Production environment approvals already enforce backup/PITR confirmation, or does the workflow need an explicit checklist?
- Can Payload's transactional migration runner be bypassed or configured for the small set of non-transactional DDL operations such as concurrent index creation?

### 2. Preview deployments may contaminate a shared preview database

Severity: `8.5/10`

Trusted PR preview deployments pull the Preview Vercel environment and deploy to Vercel. Because Vercel also runs `pnpm run ci`, a PR preview can apply that PR's migrations to the Preview database.

Why it matters:

- If all PRs share one Preview database, an unmerged PR can permanently advance preview schema.
- A later preview deploy from another branch may run against a database containing migrations that do not exist in that branch.
- Payload `migrate:status` compares known migration files to DB records, but it does not fail on DB migration records that are absent from the current checkout.
- Preview drift weakens E2E confidence because failures can depend on prior preview deployments rather than the current PR.

Current evidence:

- `.github/workflows/deploy-preview.yml` runs for trusted PRs and pulls Preview Vercel env.
- `vercel.json` and `package.json` make preview deploys run migrations before build.
- The current reset workflow is Preview-only and destructive by design, which is useful for emergencies but not a drift-prevention strategy.

Minimum next step:

- Confirm whether preview deployments share one database. If yes, add a preview drift detector that compares `payload-migrations` rows against `src/migrations/index.ts` and blocks or warns when the database has unknown migrations.

Target shape:

1. Prefer per-PR database branches, per-PR schemas, or disposable preview databases.
2. If shared preview must remain, prevent PR previews from applying migrations automatically.
3. Keep destructive preview reset as an explicit emergency workflow only.
4. Add a visible preview schema state summary to deploy output.

Open questions:

- Is the Vercel Preview `DATABASE_URI` shared across all PRs?
- Is there a Supabase branching or backup-restore workflow available for PR previews?
- Should preview database drift block preview deploys, or only block merge once DB Quality owns snapshot rehearsal?

### 3. CI validates a fresh local database, not production-shaped data

Severity: `8.5/10`

DB Quality applies migrations to a fresh local Postgres service. This catches syntax errors, missing migrations, and baseline apply failures, but it does not validate existing production data, table size, duplicate values, backfill assumptions, or lock duration.

Why it matters:

- A unique index can pass on an empty database and fail on production duplicates.
- `SET NOT NULL`, foreign keys, and check constraints can pass locally while failing on existing rows.
- Backfills can be correct on a small database but too slow or too lock-heavy on production-sized tables.
- This creates false confidence: green CI means the migration is executable, not that it is production-safe.

Current evidence:

- DB Quality starts a new Postgres container and runs `pnpm run migrate`.
- `docs/deployment-runbook.md` already says production data checks should use backup restores, snapshots, or read replicas rather than direct CI reads.

Minimum next step:

- Define a production-shape rehearsal path that restores an anonymized backup, latest snapshot, database branch, or read-replica-derived dump into disposable Postgres and then runs pending migrations.

Target shape:

1. Run fresh-DB checks on every DB-relevant PR.
2. Run production-shape rehearsal for `backfill`, `constraint-hardening`, and `destructive` migrations.
3. Capture before/after counts, null counts, duplicate checks, changed row counts, runtime, and migration status.
4. Keep production credentials out of CI jobs unless the job is explicitly designed as a read-only exception.

Open questions:

- What source is acceptable for production-shaped data: Supabase backup restore, anonymized dump, read replica, or database branch?
- How often can a snapshot be refreshed without creating operational risk?
- Which tables need redaction before being used in CI?

### 4. The advisory risk scanner misses key lock and transaction classes

Severity: `8/10`

The current risk scanner warns on destructive and compatibility-sensitive patterns, but it does not block merges. It also does not yet reason about common production lock classes such as non-concurrent index creation on existing tables, constraint validation strategy, missing timeouts, or Payload transaction incompatibility with `CREATE INDEX CONCURRENTLY`.

Why it matters:

- A short generated migration can hold locks on a large production table.
- `CREATE INDEX CONCURRENTLY` is safer for writes, but PostgreSQL requires it to run outside a transaction block.
- Payload's migration runner currently initializes a transaction for each migration, so non-transactional DDL needs an explicit strategy.
- Broad advisory warnings can become noise if they are expanded without a severity model.

Current evidence:

- The scanner emits GitHub warning annotations and exits successfully on findings.
- Payload's migration runner calls `initTransaction` before running each migration.
- Current scanner rules cover destructive operations, renames, `SET NOT NULL`, type conversion, and broad updates, but not index/constraint/timeout classes.

Minimum next step:

- Keep the scanner advisory, but add a small blocking rule set only for high-confidence incident classes after the release workflow decision is clear.

Target blocking classes:

1. Non-concurrent `CREATE INDEX` or `CREATE UNIQUE INDEX` on an existing table.
2. `CREATE INDEX CONCURRENTLY` inside the default Payload transactional migration path unless a non-transactional runner is explicitly used.
3. Direct constraint hardening on existing tables without staged `NOT VALID` or evidence of prior validation.
4. Production-bound DDL without `lock_timeout` and `statement_timeout` policy.

Open questions:

- Should blocking scanner output be part of DB Quality or a separate deep-quality lane at first?
- Can the scanner parse SQL structurally instead of relying on regex once it starts blocking merges?
- How should existing-table detection work for generated Payload migrations that create tables and indexes in the same file?

## Proposed Sequence

1. Keep the current DB Quality gate as the merge-critical baseline.
2. Configure branch protection to require only `DB Quality / db-quality-gate`.
3. Decide the production migration owner and remove production migration execution from the Vercel build path.
4. Verify preview database topology and add either preview isolation or drift detection.
5. Design production-shape rehearsal with restored backup, snapshot, read replica, or database branch.
6. Convert a very small set of scanner findings from advisory to blocking after the migration runner strategy is known.

## Further Readings

Real-world operating playbooks:

- [GitLab: Avoiding downtime in migrations](https://docs.gitlab.com/development/database/avoiding_downtime_in_migrations/) - large-scale playbooks for drops, renames, type changes, constraints, and multi-release compatibility.
- [GitLab: Migration Style Guide](https://docs.gitlab.com/development/migration_style_guide/) - practical migration authoring rules around transactions, lock retries, large tables, and multi-database targeting.
- [GitLab: Database migration pipeline](https://docs.gitlab.com/development/database/database_migration_pipeline/) - production-like migration validation patterns with timing and changed-row visibility.
- [GitLab: Post-deployment migrations](https://docs.gitlab.com/development/database/post_deployment_migrations/) - release sequencing model for changes that should run after new code is deployed.
- [GitLab: Batched background migrations](https://docs.gitlab.com/development/database/batched_background_migrations/) - operational model for large data backfills.
- [GitLab: Adding database indexes](https://docs.gitlab.com/development/database/adding_database_indexes/) - decision guide for regular, post-deployment, async, and unique indexes.
- [GitLab: Foreign keys and associations](https://docs.gitlab.com/ee/development/database/foreign_keys.html) - guidance for staged foreign key rollout and validation.
- [PayPal/Braintree: PostgreSQL at Scale - Database Schema Changes Without Downtime](https://medium.com/paypal-tech/postgresql-at-scale-database-schema-changes-without-downtime-20d3749ed680) - production payments perspective on forward/backward compatibility, lock budgets, constraints, indexes, and enum changes.
- [Stripe: Online migrations at scale](https://stripe.com/blog/online-migrations) - general online migration pattern using dual writes, backfills, verification, and source-of-truth switching.
- [Shopify: Safely Adding NOT NULL Columns to Your Database Tables](https://shopify.engineering/add-not-null-colums-to-database) - focused production advisory on required-column changes and why simple migrations can be unsafe.
- [GitHub: gh-ost, GitHub's online schema migration tool for MySQL](https://github.blog/news-insights/company-news/gh-ost-github-s-online-migration-tool-for-mysql/) - useful operating model for online schema change, throttling, testing, and controlled cutover even though it targets MySQL.
- [GitHub: MySQL infrastructure testing automation](https://github.blog/engineering/infrastructure/mysql-testing-automation-at-github/) - background on testing schema-change infrastructure continuously at GitHub scale.

Postgres-specific advisory and tooling:

- [PostgresAI: Zero-downtime Postgres schema migrations need lock_timeout and retries](https://postgres.ai/blog/20210923-zero-downtime-postgres-schema-migrations-lock-timeout-and-retries) - detailed explanation of how waiting DDL can block later reads and why strict lock timeouts matter.
- [Strong Migrations](https://github.com/ankane/strong_migrations) - practical unsafe-migration catalog that is useful even outside Rails.
- [Squawk rules overview](https://squawkhq.com/docs/rules) - Postgres migration linter rules for blocking reads/writes and breaking existing clients.
- [Squawk: require concurrent index creation](https://squawkhq.com/docs/require-concurrent-index-creation) - focused rule for index lock risk.
- [Squawk: constraint missing NOT VALID](https://squawkhq.com/docs/constraint-missing-not-valid) - focused rule for staged constraint validation.
- [MergeBrake: CREATE INDEX CONCURRENTLY in migrations](https://mergebrake.dev/postgres-create-index-concurrently) - PR-review framing for unsafe generated indexes.
- [thoughtbot: Create Postgres indexes concurrently in migrations](https://thoughtbot.com/blog/how-to-create-postgres-indexes-concurrently-in) - concise production-oriented explanation of index locks and transaction constraints.
- [Brandur: Safely renaming a table with no downtime using updatable views](https://brandur.org/fragments/postgres-table-rename) - concrete rename strategy focused on running clients, not just SQL syntax.
- [Bytebase: Postgres schema migration without downtime](https://www.bytebase.com/blog/postgres-schema-migration-without-downtime/) - operational overview of lock timeouts, staged changes, and deploy sequencing.
- [Database Migrations Guide: Postgres indexes](https://expobrain.github.io/database-migrations-guide/postgres/add/indexes/) - compact explanation of unsafe indexes, concurrent indexes, and invalid-index retry concerns.

Preview environments, database branching, and schema deployment control:

- [Supabase: Branching](https://supabase.com/docs/guides/deployment/branching) - separate preview environments for testing migrations and config changes without touching production.
- [Supabase: Branching feature overview](https://supabase.com/features/branching) - high-level branching model and preview deployment integration.
- [Neon: One branch per preview](https://neon.com/branching/ci-preview-workflows) - dedicated database branch per Vercel/Netlify preview deployment.
- [PlanetScale: Deploy requests](https://planetscale.com/docs/concepts/deploy-requests) - reviewable schema diffs, safe migrations, gated deploys, and schema revert windows.
- [PlanetScale Postgres: Branching](https://planetscale.com/docs/postgres/branching) - isolated database branches for development, testing, and backup restore workflows.
- [Xata: Zero downtime schema changes with Vercel and Xata](https://xata.io/blog/zero-downtime-schema-changes-with-vercel-and-xata) - relevant because this project also combines Vercel previews with Postgres schema changes.
- [Xata: Schema changes](https://xata.io/docs/core-concepts/schema-changes) - pgroll-backed approach with multi-version schemas and lock-safe migrations.
- [Xata: How to perform Postgres schema changes in production with zero downtime](https://xata.io/blog/zero-downtime-schema-migrations-postgresql) - advisory material around reversible schema changes and pgroll.
- [pgroll](https://github.com/xataio/pgroll) - open-source Postgres tool for reversible, zero-downtime schema changes.

Framework examples:

- [Prisma: Expand-and-contract migrations](https://www.prisma.io/docs/guides/database/data-migration) - framework-specific, but useful as a clear expand/contract example.
- [Payload: Migrations](https://payloadcms.com/docs/database/migrations) - Payload's migration commands and expected workflow.

Reference documentation:

- [PostgreSQL: ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) - lock levels, `NOT VALID`, validation, and constraint behavior.
- [PostgreSQL: CREATE INDEX](https://www.postgresql.org/docs/current/sql-createindex.html) - concurrent index creation and transaction limitations.
- [PostgreSQL: Client connection defaults](https://www.postgresql.org/docs/current/runtime-config-client.html) - `lock_timeout` and `statement_timeout`.
- [PostgreSQL: Explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) - lock modes and conflict behavior.
