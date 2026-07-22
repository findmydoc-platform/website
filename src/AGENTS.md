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

### Payload and UI Boundary

- Payload is the source of truth for CMS-backed data across `src/**`.
- Presentational UI under `src/components/**` must stay Payload-free and must not import `@/payload-types`.
- Normalize Payload unions such as links, media, and relations in adapter layers before passing props into reusable UI.
- Shared UI contracts: links use `{ href: string; label?: string | null; newTab?: boolean }`; rich text uses `ReactNode`; media uses `{ src?: string; width?: number; height?: number; alt?: string }`.
- Reusable styling and variants belong in `src/components/**`; Payload-aware mapping belongs in `src/blocks/**` or route-level adapters; shared CMS adapters belong in `src/blocks/_shared/**`.
- Compute CMS-derived routes in adapters, not presentational components.
- If a component needs Payload imports, move the mapping to an adapter and pass normalized props into the UI layer.

### Global Engineering Rules (Critical First)

1. Use Payload-native APIs and migrations for Payload-managed data; never use direct SQL or database-adapter access, and stop for an explicit architecture decision if Payload has no suitable mechanism.
2. Business logic and side effects belong in hooks (`src/hooks/**` or collection hooks), not UI components.
3. Access rules must reuse helpers in `src/access/**`; avoid duplicate role logic.
4. Collections should remain minimal, indexed where needed, and documented via `admin.description`.
5. Respect soft delete (`trash: true`) patterns unless destructive behavior is explicitly required.
6. Avoid `any`; use `unknown` plus narrowing.
7. Do not hard-code secrets; only read from environment variables.
8. Keep `.secrets.baseline` synchronized with branch changes; when `detect-secrets` updates the baseline, commit it with the related change.

### Cache And Revalidation Boundary

- Before finalizing a change to a collection, global, public route, server-data loader, hook, sitemap, discovery flow, or seed flow, use `$cache-impact-planner`.
- Record exactly one decision: `no-public-impact`, `public-live`, or `public-cached`. New collections and globals require a cache-policy catalog classification; static public pages do not.
- `public-cached` work uses existing cache classes, policy builders, canonical read tags, a planner event and owner, and focused read/write-symmetry tests. Draft, preview, private, and request-bound data stays live.
- Do not invent cache classes, tag families, owner types, or direct invalidation. Stop for unclear freshness, a new route family, remote storage, or Cache Components primitives that need an ADR decision.

### Validation Policy

- Follow the repository-level validation policy in `AGENTS.md`; this section is only a `src/**` routing summary.
- For `src/**` runtime changes that affect Next.js, Storybook, Payload config, routing, or output tooling, expect `pnpm check`, `pnpm build`, and `pnpm format`.
- Light-only `src/**` documentation or instruction changes may skip `pnpm check` and `pnpm build`; still run `pnpm format` and any root-required instruction checks.

### Testing Expectations

- Use Vitest for unit and integration coverage; use Playwright for `tests/e2e/**` under the local E2E instructions.
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
- Treat mobile-first layout and interaction behavior as the default frontend design mode; see `docs/frontend/mobile-ai-playbook.md` for the canonical viewport matrix, review checklist, and prompt scaffolding.

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
