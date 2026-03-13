## findmydoc-portal — AI Contributor Guide

Primary product and brand name: `findmydoc` (lowercase).

This guide defines global defaults. Scoped rules in `.github/instructions/*.instructions.md` override global details for their domain.

### Priority Model

- `P0 Safety/Correctness`: security, data integrity, migrations, access control, and factual correctness.
- `P1 Task Completion`: implement the requested change end to end with minimal side effects.
- `P2 Style`: wording, formatting, and presentation quality after P0/P1 are satisfied.

### Architecture Snapshot

- Single app: PayloadCMS + Next.js App Router, shared `src/`.
- Server truth lives in Payload; frontend should stay thin and presentation-oriented.
- Core domains: auth, clinic network, content, geo entities, and role-based access.

### Global Engineering Rules (Critical First)

1. Schema changes use Payload migrations; do not hand-write SQL.
2. Business logic and side effects belong in hooks (`src/hooks/**` or collection hooks), not UI components.
3. Access rules must reuse helpers in `src/access/**`; avoid duplicate role logic.
4. Collections should remain minimal, indexed where needed, and documented via `admin.description`.
5. Respect soft delete (`trash: true`) patterns unless destructive behavior is explicitly required.
6. Avoid `any`; use `unknown` plus narrowing.
7. Do not hard-code secrets; only read from environment variables.

### Validation Policy

- Runtime-core changes likely affecting runtime behavior: run `pnpm check`, `pnpm build`, `pnpm format`.
- CI-critical changes only (`.github/workflows/**`, `.github/scripts/**`, `scripts/**`): run `pnpm check`, `pnpm format`.
- Light-only documentation/instruction changes: skip heavy runtime validation.

### Testing Expectations

- Use Vitest and existing patterns under `tests/**`.
- Prioritize access control, auth flows, and hook behavior.
- When introducing a new collection/access rule, align permission-matrix tests and docs.

### Seeding and Data Workflow

- Baseline seeds are idempotent and production-safe.
- Demo seeds are resettable and non-production.
- Keep seed ordering dependency-safe and documented in `docs/seeding.md`.

### Frontend Baseline

- Prefer RSC by default; use client components only at interaction leaves.
- Keep UI components Payload-free; map CMS shapes in block adapters.
- Use Tailwind + shadcn atoms in `src/components/atoms`.

### Scope and References

- Domain-specific rules:
  - Frontend: `.github/instructions/frontend.instructions.md`
  - Payload admin UI design: `.github/instructions/admin-ui-design.instructions.md`
  - CMS/UI boundary: `.github/instructions/cms-ui-boundary.instructions.md`
  - Payload/API/hooks/seeds: `.github/instructions/payload.instructions.md`
  - Tests: `.github/instructions/tests.instructions.md`
  - PR metadata: `.github/instructions/pull-requests.instructions.md`
  - AI anti-slop behavior: `.github/instructions/ai-anti-slop.instructions.md`

### Implementation Triage

1. Confirm impacted domains and applicable scoped instructions.
2. Apply the minimal change set that satisfies the request.
3. Run required validation commands based on changed paths.
4. Keep changes explainable with concrete references (files, commands, logs).
