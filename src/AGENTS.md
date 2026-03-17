## findmydoc-portal — Engineering Defaults

Primary product and brand name: `findmydoc` (lowercase).

This guide defines shared defaults for `src/**`. Nested `AGENTS.md` files override details for their domain.

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
8. Keep `.secrets.baseline` synchronized with branch changes; when `detect-secrets` updates the baseline, commit it with the related change.

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
- Story metadata must comply with `docs/frontend/story-governance.md`.

### Domain Routing

- UI components: `src/components/AGENTS.md`
- Frontend routes and UI assembly: `src/app/(frontend)/AGENTS.md`
- UI and Payload boundary adapters: `src/blocks/AGENTS.md` and `src/app/AGENTS.md`
- Payload/API/hooks/seeds: `src/collections/AGENTS.md`, `src/hooks/AGENTS.md`, `src/endpoints/seed/AGENTS.md`, `src/app/api/AGENTS.md`
- Payload admin UI design: `src/app/(payload)/AGENTS.md`, `src/components/organisms/AdminBranding/AGENTS.md`, `src/components/organisms/DeveloperDashboard/AGENTS.md`, `src/dashboard/adminDashboard/AGENTS.md`
- Storybook and UI test fixtures: `src/stories/AGENTS.md`
- Repository-level quality constraints: `AGENTS.md`

### Implementation Triage

1. Confirm impacted domains and applicable local `AGENTS.md` files.
2. Apply the minimal change set that satisfies the request.
3. Run required validation commands based on changed paths.
4. Keep changes explainable with concrete references (files, commands, logs).
