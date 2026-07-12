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
- For field labels and descriptions, keep copy short, plain, and self-contained for first-time clinic users.
- Explain what a field is for and what to enter, but do not add history, implementation notes, or status-quo wording.
- Prefer leaving already clear copy unchanged over rewriting for style.
- Run `$cache-impact-planner` before finalizing a new or materially changed collection or global. Add its catalog classification even when the result is `no-public-impact` or `public-live`.
- When a collection owns public cached output, its hook adapter builds a normalized planner event from stable old and new identities or relations and respects `context.disableRevalidate`.
- Do not import `next/cache` or construct cache tags in collection code.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep baseline seeds idempotent and demo seeds resettable per `docs/seeding.md`.
- Avoid shadowing Payload REST catch-all routes unless explicitly justified and verified.
