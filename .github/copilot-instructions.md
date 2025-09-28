## findmydoc-portal — AI Contributor Guide

Concise rules for productive, safe changes. Focus on THIS repo’s patterns; prefer examples below over generic advice.

### 1. Architecture & Domains
Monorepo-style single app: PayloadCMS (API + admin) + Next.js App Router (frontend) sharing `src/`. Core domains: authentication (Supabase ↔ Payload), medical network (clinics, doctors, treatments, specialties), content (posts/pages, tags, categories), geo (countries/cities), user roles (platform, clinic, patient). Server truth = Payload; frontend is a thin consumer (no business validation client-side).

### 2. Golden Rules
1. Do NOT hand‑write SQL / use drizzle — always create & apply migrations via Payload CLI after schema changes.
2. Put business logic & side effects in Payload hooks (`src/hooks/**`), not React components.
3. Reuse access utilities in `src/access/` and scope filters; never duplicate role checks.
4. Keep collections minimal: required fields (`required: true`), index frequently queried relationships (`index: true`), add `admin.description`.
5. Respect soft delete (`trash: true`) – avoid permanent deletes unless intentional.

### 3. Key Directories (anchor examples)
`src/collections/Clinics.ts` (schema + access); `src/access/*` (role/scope decisions); `src/auth/strategies/` (Supabase JWT strategy); `src/endpoints/seed/**` (baseline + demo seeding units); `src/components/organisms/` (block ↔ organism mapping); `tests/unit/access/` (canonical access test patterns).

### 4. Auth & Users
Supabase JWT in `Authorization` header → custom strategy finds/creates internal user (JIT). Staff = `basicUsers` + profile (`platformStaff` | `clinicStaff`); patients single record. Clinic staff blocked until approval (see permission matrix). Never store or reuse plaintext passwords—provisioning hook creates Supabase identity then discards transient secret.

### 5. Access Control Pattern
All authorization centralized: functions in `src/access/` return boolean or filter objects (e.g. scoping clinic resources). Always call existing helpers (`isPlatformBasicUser`, etc.) from new access rules. Patients restricted to their own records; clinic staff scoped to their clinic; platform staff full RWDA.

### 6. Seeding System
Baseline (idempotent, production‑safe) vs Demo (resettable, non‑prod). Endpoint: `POST /api/seed?type=baseline|demo&reset=1`. Add new seed: create `seed<X>.ts` returning `{ created, updated }`, register in ordered list, maintain dependencies (e.g. specialties before treatments). Demo reset uses ordered destructive clear; baseline never clears. Summary cached in memory.

### 7. Migrations & DB Reset
Workflow: `pnpm payload migrate:create <name>` then `pnpm payload migrate`. Status with `pnpm payload migrate:status`. Local rapid iteration can rely on push adapter, but ALWAYS commit migrations for shared schema changes. Destructive resets only via documented scripts.

### 8. Frontend Conventions
Atomic layers: atoms → molecules → organisms (blocks) → templates → pages. Block `slug` must match organism filename; dynamic renderer lives in `src/blocks/RenderBlocks.tsx`. Prefer RSC; only mark components `'use client'` at interaction leaves. Styling via Tailwind + shadcn/ui; extend using CVA variants rather than wrapper components.

### 9. Testing Strategy
Vitest central. Test sources live under `tests/` (not beside code). Priorities: access (100%), auth, hooks. Patterns: parameterized `test.each` for role matrices; scope filters assert exact filter object shape. Use helpers in `tests/unit/helpers/` (`mockUsers`, `createMockReq`). Avoid testing Payload internals or generated types.

### 10. Implementation Checklist (Before Commit)
1. Added/changed collection? Create & apply migration, run `pnpm generate` if needed.
2. Added access logic? Provide corresponding unit tests in `tests/unit/access-matrix/`.
3. Added new collection? Add to permission matrix (`docs/security/permission-matrix.json`) and create `tests/unit/access-matrix/<slug>.permission.test.ts`.
4. Added seed unit? Idempotent baseline OR documented demo; update `docs/seeding.md` if new domain.
5. Run: `pnpm check` (types + lint), `pnpm matrix:verify` (permission alignment), and relevant tests.
6. Avoid secrets or credentials in code / logs.

### 11. When Extending
New user type → decide single vs profile model; mirror provisioning hook pattern; extend permission matrix semantics via `src/access/` utilities. New block → add Payload block (slug) + organism component with same name; update renderer map if required.

### 12. Common Pitfalls
Skipping migration creation, duplicating role checks inline, adding client-side validation logic, forgetting index on heavy relationship fields, or writing non-idempotent baseline seeds.

### 13. Core Commands (pnpm only)
Dev: `pnpm dev`  |  Type/Lint: `pnpm check`  |  Migrate: see section 7  |  Tests: `pnpm tests`  |  Seed baseline/demo: use dashboard or `scripts/seed-*.ts` via ts-node.

Provide changes focused, minimal, and aligned with these rules. Ask for clarification only when a domain rule is ambiguous or undocumented.

### 14. Environment & Feature Flags
Required env (see `.env.example` & `src/environment.d.ts`): `PAYLOAD_SECRET`, `DATABASE_URI`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_JWT_SECRET`. Test env loads `.env.test` automatically in `payload.config.ts` when `NODE_ENV=test`. Developer Dashboard gated by `FEATURE_DEVELOPER_DASHBOARD=true` (injects component via `beforeDashboard`). Never hard‑code secrets; reference only through `process.env`.

### 15. Minimal Patterns (Copy/Paste)
Access boolean test:
```ts
test.each([
	['platform', mockUsers.platform(), true],
	['clinic', mockUsers.clinic(), false],
	['patient', mockUsers.patient(), false],
])('%s access', (_d,u,exp)=>{
	expect(isPlatformBasicUser({ req: createMockReq(u) })).toBe(exp)
})
```
Scoped filter expectation:
```ts
const res = await clinicScopedAccess({ req: createMockReq(mockUsers.clinic()) })
expect(res).toEqual({ clinic: { equals: expect.any(Number) } })
```

### 16. Adding / Modifying Seeds (Micro Checklist)
1. Create `seed<Domain>.ts` in appropriate folder under `src/endpoints/seed/...` returning `{ created, updated }`.
2. Insert into ordered `baselineSeeds` or `demoSeeds` array (respect dependency order).
3. Baseline: upsert by unique field; Demo: skip duplicates by slug.
4. Update `docs/seeding.md` summary table.
5. Run baseline seed to confirm idempotency (2nd run => created:0).

### 17. Safeguards & Warnings
- If you add a collection and forget a migration the CI review will block; always run migrate commands after schema edits.
- Do not bypass access helpers—inline role conditionals are PR rejection candidates.
- Soft delete (`trash: true`) means destructive endpoints should rarely be introduced; prefer restore workflows.
- Jobs access in `payload.config.ts` allows bearer cron secret fallback—do not weaken this path.
- **Permission Matrix Alignment**: Every collection must exist in `docs/security/permission-matrix.json` and have a test in `tests/unit/access-matrix/`. Run `pnpm matrix:verify` before committing.

### 18. Quick Triage Flow (Agent)
Schema change? → Migration + types regen → Access rules + tests → Seeds if reference data → Docs touch-up (seeding / permission matrix if role impact) → `pnpm check` & tests.

### 19. Hooks Structure & Conventions (concise)

Prefer a predictable place for every hook. Keep collections readable; put reusable logic in one spot.

Folder layout
```
src/
	payload.config.ts          // global hooks only (telemetry, logging)
	hooks/                     // shared hooks used by 2+ collections
		slugify.ts
		auditTrail.ts
		ownership.ts
	collections/
		Posts/
			index.ts               // collection config
			hooks/                 // collection-specific hooks (one file = one hook)
				revalidatePost.ts
				computePostSlug.ts
		Clinics/
			index.ts
			hooks/
				beforeChangeFreezeOwnership.ts
		Users/
			index.ts
```

Decision rules
- Inline: only if truly tiny (≤30–40 lines) and one-off.
- Collection-specific: place under `collections/<Name>/hooks/` with one hook per file. Filename states intent, e.g. `revalidatePage.ts`, `computeStoragePath.ts`, `beforeChangeFreezeOwnership.ts`.
- Shared: put cross-collection hooks in `src/hooks/`.
- Global: use `payload.config.ts` only for app-wide hooks.

Quick checklist
- [ ] Is the hook tiny and one-off? Keep inline; otherwise move it.
- [ ] For collection hooks, create `collections/<Name>/hooks/<action>.ts` and export a single hook.
- [ ] For shared logic, prefer `src/hooks/<name>.ts` and import where needed.
