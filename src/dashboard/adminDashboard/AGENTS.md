# Payload Admin Dashboard Widgets

## Priorities

- `P0`: Keep Admin UX stable by using official Payload admin extension points only.
- `P1`: Keep branding and theme changes conservative and reversible.
- `P2`: Keep widget visuals consistent with core Payload tokens.

## Dashboard Widget Rules

- Dashboard widgets and their subcomponents must remain resilient with default Payload spacing, typography, and elevations.
- Widget styling should continue to rely on Payload admin theme variables (`--theme-*`) to avoid regressions when tokens evolve.
- New widget controls should be typed and normalized at component boundaries.
- Keep custom admin components lightweight and presentational; avoid business logic there.

## Validation Expectations

- For runtime-affecting admin UI changes run: `pnpm check`, `pnpm build`, `pnpm format`.
- Verify key admin screens visually (login + dashboard) with Playwright screenshots in ignored artifacts directories.
- For local verification behind admin login, prefer the shared Playwright session `output/playwright/sessions/admin.local.json` and refresh it with `pnpm playwright:session:record -- --persona admin` if needed.
