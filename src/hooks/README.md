# Shared Hooks

Place reusable hooks (used across multiple collections/fields) in this directory.

Guidelines:

- Keep per-collection bespoke hooks next to the collection as `hooks.ts`.
- Only move logic here if it’s used by 2+ collections.
- Avoid business logic in components; prefer hooks as the source of truth.

Examples to consider extracting in future:

- `slugify` for blocks and pages
- audit trail hooks
- ownership enforcement utilities
