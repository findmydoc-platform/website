# Payload API Route Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Reuse `src/access/**` helpers; avoid duplicated role logic.
- Keep side effects in hooks or service layers, not route glue code.
- Maintain soft-delete behavior unless destructive semantics are explicitly required.
- Avoid shadowing Payload REST catch-all routes unless explicitly justified and verified.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep API behavior consistent with Payload source-of-truth semantics.
