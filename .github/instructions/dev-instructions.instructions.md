---
applyTo: "**/*"
---

# Dev-wide Copilot instructions

- Stack: PayloadCMS v3, Next.js App Router, Supabase (Postgres + Auth), Tailwind, shadcn/ui, Vitest, TypeScript.
- Source of truth: Payload is where content, validation, and business logic live; the Next.js app is a thin consumer (no business validation in React).
- No raw SQL or drizzle: all schema changes go through Payload migrations (`pnpm payload migrate:create`, then `pnpm payload migrate`).
- Centralize authorization and scoping in `src/access/**` and reuse existing helpers instead of writing ad-hoc role checks.
- Put business logic and side-effects in Payload hooks under `src/hooks/**` or `collections/<Name>/hooks/**`, not in React components.
- Respect soft delete (`trash: true`) and existing seeding/matrix patterns; when adding collections or access rules, also update tests under `tests/unit/access-matrix/**` and the permission matrix docs.
- Prefer React Server Components; only use `'use client'` for interactive leaf components.
- Tests live under `tests/**` (unit, integration) using Vitest; follow the patterns and helpers already present instead of inventing new structures.
- **TypeScript Standards**: Do not use the `any` type. Use `unknown` for uncertain data and narrow it using type guards, Zod schemas, or explicit casting (`as unknown as T`) if absolutely necessary.

- **Language**: Keep **all code** in English (identifiers, comments, internal/default strings, aria-labels). Any localized/user-facing copy must come from content or props (do not hardcode non-English defaults in components).
