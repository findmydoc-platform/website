# Payload Collections and Data Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Use Payload config types and keep collection/global config under `src/collections/**`.
- Use Payload migrations for schema changes: `pnpm payload migrate:create <name>` then `pnpm payload migrate`.
- Keep side effects in hooks, not UI components.
- Reuse `src/access/**` helpers; avoid duplicated role logic.
- Maintain soft-delete behavior unless destructive semantics are explicitly required.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep baseline seeds idempotent and demo seeds resettable per `docs/seeding.md`.
- Avoid shadowing Payload REST catch-all routes unless explicitly justified and verified.
