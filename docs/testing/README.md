# Testing Guide

Use this folder as the entry point for our Payload/Next testing story. Each page keeps the language light so you can scan, dive into code, and ship.

## Run Commands

```bash
pnpm tests                 # full suite
pnpm tests --project=unit
pnpm tests --project=integration
pnpm tests --coverage
pnpm tests --watch         # iterate locally
```

## Read Me Next

- [Setup & Environment](./setup.md) — tooling, env vars, and the global database lifecycle
- [Testing Strategy](./strategy.md) — what we cover, how we prioritise, and when to add new suites
- [Access Control](./access-control.md) — keeping collections aligned with the permission matrix
- [Patterns & Utilities](./patterns.md) — helpers, fixtures, and reuse guidance

## Repository Layout

All tests live under `tests/`:

- `tests/unit/access` — standalone access utilities
- `tests/unit/collections` — collection configs aligned with the permission matrix metadata
- `tests/unit/hooks`, `tests/unit/auth`, `tests/unit/helpers` — domain-specific logic and shared mocks
- `tests/integration` — payload + supabase flows with controlled fixtures
- `tests/setup` — global setup scripts (Docker lifecycle, Vitest glue)

## Coverage Expectations

- Access control and permission matrix suites: ~100%
- Hooks and auth flows: ≥80%
- Collections: ≥70%
- Overall project: ≥70%

### Coverage Enforcement

Coverage thresholds are enforced via Vitest's native configuration (`vitest.config.ts`):

- **Statements:** 70%
- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%

**Local Auto-Ratcheting:**
When running tests locally (outside CI), Vitest will automatically update thresholds in `vitest.config.ts` if your coverage meaningfully exceeds the current floor. This prevents coverage regression without manual intervention.

**How It Works:**
- CI runs with `CI=true`, which disables auto-update to keep thresholds stable
- Locally, `autoUpdate: true` allows Vitest to bump thresholds when coverage improves
- After a local run that increases coverage, commit the updated `vitest.config.ts` to raise the bar for everyone

**Best Practices:**
- Run `pnpm tests --coverage` locally to see current coverage levels
- If coverage increases significantly (e.g., +5%), the thresholds will auto-update
- Review the updated thresholds in `vitest.config.ts` before committing
- Document any intentional coverage increases in your PR description

## Shared Expectations

- Use `overrideAccess: true` when writing setup data so tests focus on the logic under inspection.
- Clean fixtures in reverse order (children before parents) to keep the database tidy.
- Let the provided setup scripts manage Docker containers; no manual compose commands are required.