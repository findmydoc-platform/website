# Payload Hooks Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Keep side effects in hooks, not UI components.
- Reuse `src/access/**` helpers; avoid duplicated role logic.
- Maintain soft-delete behavior unless destructive semantics are explicitly required.
- Keep hook logic deterministic, testable, and scoped to the owning collection/global.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep baseline seeds idempotent and demo seeds resettable per `docs/seeding.md`.
