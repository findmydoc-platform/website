# Payload Migration Rules

## Priorities

- `P0`: Production data safety, migration integrity, and deploy compatibility.
- `P1`: Clear expand/backfill/switch/contract rollout sequencing.
- `P2`: Concise migration notes and reviewability.

## Critical Rules

- Create migration files with `pnpm payload migrate:create <name>`; do not create migrations manually from scratch.
- Classify every migration as additive, backfill, constraint-hardening, or destructive before editing or approving it.
- Prefer production-compatible multi-release changes: expand first, backfill idempotently, switch application reads/writes, then contract later.
- Do not combine field/table drops, renames, required constraint hardening, or data deletion with the first release that introduces the replacement shape.
- Manual migration edits are allowed only for idempotent backfills, data-safety corrections, or reviewed Payload output adjustments.
- Backfills must be safe to rerun and should use scoped predicates such as `WHERE <new_column> IS NULL` where possible.
- Destructive changes require documented backup/PITR readiness, before/after counts, and a separate contract-stage PR or release.
- Do not query production from CI. Production data checks use snapshots, backup restores, or read replicas by default.

## Review Checklist

- State whether the current app version and the next app version can both run against the migrated schema.
- For renamed fields, add the new field first and keep the old field until all reads/writes have switched.
- For new required fields, add nullable/defaulted storage first, backfill, verify null counts, then enforce required constraints later.
- For deleted data, prefer soft-delete or archival states before hard deletion.
