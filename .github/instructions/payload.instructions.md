---
applyTo: 'src/collections/**/*.ts,src/hooks/**/*.ts,src/endpoints/seed/**/*.ts,src/app/api/**/*.ts'
---

# Payload collections, hooks, and seeds

- Collections and globals must use Payload config types (`CollectionConfig`, `GlobalConfig`) and live under `src/collections/**`.
- Do not write raw SQL or use schema tools like drizzle; after schema changes, run Payload migrations (`pnpm payload migrate:create <name>` then `pnpm payload migrate`).
- Put reusable logic and side-effects in hooks (`src/hooks/**` or `collections/<Name>/hooks/**`), not in React components.
- Centralize access logic via helpers in `src/access/**`; avoid inline role checks when existing helpers can be reused.
- Respect soft delete (`trash: true`) and existing patterns for seeding and the permission matrix.
- When adding or changing a collection or access rule, also plan to update permission-matrix tests under `tests/unit/access-matrix/**` and `docs/security/permission-matrix.json`.
- Baseline vs demo seeds must follow the documented seeding system under `docs/seeding.md` (idempotent baseline, resettable demo).
- **API routes**: Avoid shadowing Payload’s REST API catch‑all with per‑collection Next.js routes (e.g. `/api/<collection>`). Shadow only with a clear, documented rationale and verify admin UI relationship lookups still work.
