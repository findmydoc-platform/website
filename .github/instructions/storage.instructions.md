---
applyTo: 'src/plugins/**/*.ts,src/utilities/storage/**/*.ts,src/hooks/media/**/*.ts,src/collections/**/*Media*/**/*.ts,scripts/storage-*.ts,tests/integration-live/**/*.ts,tests/unit/utilities/storageRuntime.test.ts,vitest.config.ts,package.json,.env.example,docker-compose.storage-test.yml,docs/integrations/storage.md,docs/setup.md,docs/testing/README.md'
---

# Storage and Upload Rules

## Priorities

- `P0`: Do not ship changes that can create database records without persisted file or object bytes.
- `P1`: Keep local reproduction fast, deterministic, and close to preview behavior.
- `P2`: Keep diagnostics explicit enough that upload failures can be traced without guesswork.

## Critical Rules

1. Treat document persistence and file or object persistence as separate success criteria.
2. Verify the active runtime mode before debugging uploads: local filesystem, S3 emulator, or cloud parity.
3. Prefer the shared storage runtime helpers over ad-hoc `NODE_ENV` and `S3_*` checks.
4. When cloud storage is enabled, fail fast if required S3 configuration is incomplete.
5. Do not assume preview upload failures are database issues; verify request-size limits, runtime config, bucket access, and object creation first.
6. Keep storage diagnostics structured and include `collection`, `filename`, `storagePath`, `bucket`, and the failure reason when available.
7. Update storage workflow docs whenever developer commands, runtime modes, or reproduction steps change.

## Required Validation

- Run `pnpm ai:slop-check` when changing these instruction files.
- Run `pnpm tests:storage-live` for changes affecting upload flow, storage runtime selection, S3 helpers, media hooks, or storage smoke scripts.
- If the change also affects runtime behavior outside the storage test lane, follow the repository runtime validation policy with `pnpm check`, `pnpm build`, and `pnpm format`.

## Reproduction Workflow

1. Identify the active storage mode first.
2. Reproduce with `pnpm storage:smoke` or `pnpm storage:smoke:minio` before editing behavior.
3. If the issue appears only on preview, reproduce locally with the cloud-parity lane before concluding it is provider-specific.
4. After each attempted fix, verify both outcomes:
   - the Payload document exists
   - the underlying file or object exists
5. If visibility is weak, enable storage diagnostics before changing business logic.

## Testing Expectations

- Add or update deterministic tests for runtime-mode selection and storage config validation.
- Prefer at least one behavior-level smoke path for upload bugs; do not rely only on mocked storage adapters.
- Keep MinIO or parity-lane tests opt-in and focused on object persistence, not on unrelated Payload internals.
