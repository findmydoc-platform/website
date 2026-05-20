# Payload Seeds and Endpoint Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Keep baseline seeds idempotent and production-safe.
- Keep demo/preview/sample seeds resettable and strictly non-production. Production may run baseline seeds only; any request, retry, queue advancement, task handler, CLI, or helper path that would create demo/preview/sample records in production must fail closed. Do not add feature flags, overrides, or special cases that allow demo/preview/sample data creation in production.
- Keep seed ordering dependency-safe and documented in `docs/seeding.md`.
- Avoid shadowing Payload REST catch-all routes unless explicitly justified and verified.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep seed execution deterministic and safe for repeated runs.
