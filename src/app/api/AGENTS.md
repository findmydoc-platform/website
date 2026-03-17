# Payload API Route Rules

## Priorities

- `P0`: Data correctness, secure access, and migration integrity.
- `P1`: Reusable access and hook patterns.
- `P2`: Documentation and test alignment.

## Critical Rules

- Reuse `src/access/**` helpers; avoid duplicated role logic.
- Keep side effects in hooks or service layers, not route glue code.
- Maintain soft-delete behavior unless destructive semantics are explicitly required.
- Do not add Next.js routes under `/api/<payload-collection>/**` for Payload-managed collections (for example `/api/forms/**`, `/api/pages/**`, `/api/posts/**`).
- Payload REST is served by `src/app/(payload)/api/[...slug]/route.ts`; shadowing it can break Admin operations (for example relation lookups and `PATCH /api/<collection>/<id>`).
- For custom endpoints, use non-conflicting namespaces such as `/api/auth/**`, `/api/form-bridge/**`, or `/api/internal/**`.
- Exception only with explicit product/architecture approval, documentation in `docs/setup.md`, and regression coverage for the affected collection routes.

## Alignment Requirements

- Update permission-matrix tests and docs when access behavior changes.
- Keep API behavior consistent with Payload source-of-truth semantics.
