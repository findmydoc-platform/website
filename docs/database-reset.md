# Local Database Reset (Test Only)

Use destructive reset commands only on disposable local databases and local test runs.

## Allowed Commands (Local Only)

```bash
# Drop and recreate local schema, then apply migrations
pnpm payload migrate:fresh

# Rebuild local DB/migration files from scratch (destructive)
pnpm run generateDBFromScratch
```

## Not Allowed in Preview/Production

- Do not run `migrate:fresh` in production.
- Do not use `DB_FRESH=true` in deployed environments.
- Production must move forward via committed migrations only.

## Preview Emergency Reset Workflow

A manual GitHub Actions workflow exists for exceptional preview reset cases only:

- Workflow: **Reset Database**
- Environment: **Preview** only
- Required confirmation input: `RESET_PREVIEW_DB`

The workflow is intentionally blocked for production.

## Standard Migration Workflow

```bash
pnpm payload migrate:create <name>
pnpm payload migrate
pnpm payload migrate:status
```

For deploy order and environment behavior, see [Deployment & Migration Runbook](./deployment-runbook.md).
