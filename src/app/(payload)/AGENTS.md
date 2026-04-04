# Payload Admin UI Design

## Priorities

- `P0`: Keep Admin UX stable by using official Payload admin extension points only.
- `P1`: Keep branding and theme changes conservative and reversible.
- `P2`: Keep widget visuals consistent with core Payload tokens.

## Critical Rules

- Do not edit generated files under `src/app/(payload)/admin/**`.
- Inject branding through `admin.components.graphics` and related documented admin component hooks.
- Use `admin.components.providers` for global admin token tweaks; avoid broad CSS overrides or selector-heavy hacks.
- Keep `admin.theme` behavior explicit and compatible with the configured mode.
- Prefer existing `var(--theme-*)` tokens in widgets and custom admin components.
- Keep custom admin components lightweight and presentational; avoid business logic there.
- For admin-triggered, user-actionable failures (validation, business rules), throw public Payload errors (`APIError` / `ValidationError`) with clear messages so notifications show actionable text instead of generic failures.

## Dashboard Widgets

- Dashboard widgets and their subcomponents must remain resilient with default Payload spacing, typography, and elevations.
- Widget styling should continue to rely on Payload admin theme variables (`--theme-*`) to avoid regressions when tokens evolve.
- New widget controls should be typed and normalized at component boundaries.

## Validation Expectations

- For runtime-affecting admin UI changes run: `pnpm check`, `pnpm build`, `pnpm format`.
- Verify key admin screens visually (login + dashboard) with Playwright screenshots in ignored artifacts directories.
- If admin UI changes alter operator-facing flows documented in `docs/guides/**`, update the affected guide and refresh stale screenshots in the same change.
