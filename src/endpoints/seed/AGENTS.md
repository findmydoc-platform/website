# Payload Seeds and Endpoint Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Keep baseline seeds idempotent and production-safe.
- Keep demo seeds resettable and non-production.
- Keep seed ordering dependency-safe and documented in `docs/seeding.md`.
- Avoid shadowing Payload REST catch-all routes unless explicitly justified and verified.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep seed execution deterministic and safe for repeated runs.
