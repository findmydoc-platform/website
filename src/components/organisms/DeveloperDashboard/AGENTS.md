# Payload Developer Dashboard UI

## Priorities

- `P0`: Keep Admin UX stable by using official Payload admin extension points only.
- `P1`: Keep branding and theme changes conservative and reversible.
- `P2`: Keep widget visuals consistent with core Payload tokens.

## Critical Rules

- Keep custom admin components lightweight and presentational; avoid business logic there.
- Prefer existing `var(--theme-*)` tokens in widgets and custom admin components.
- New widget controls should be typed and normalized at component boundaries.

## Dashboard Widgets

- Dashboard widgets and their subcomponents must remain resilient with default Payload spacing, typography, and elevations.
- Widget styling should continue to rely on Payload admin theme variables (`--theme-*`) to avoid regressions when tokens evolve.

## Validation Expectations

- For runtime-affecting admin UI changes run: `pnpm check`, `pnpm build`, `pnpm format`.
- Verify key admin screens visually (login + dashboard) with Playwright screenshots in ignored artifacts directories.
