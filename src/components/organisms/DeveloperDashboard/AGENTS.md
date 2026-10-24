# Payload Developer Dashboard UI

## Critical Rules

- Keep custom admin components lightweight and presentational; avoid business logic there.
- Prefer existing `var(--theme-*)` tokens in widgets and custom admin components.
- New widget controls should be typed and normalized at component boundaries.

## Dashboard Widgets

- Dashboard widgets and their subcomponents must remain resilient with default Payload spacing, typography, and elevations.
- Widget styling should continue to rely on Payload admin theme variables (`--theme-*`) to avoid regressions when tokens evolve.

## Validation Expectations

- For runtime-affecting admin UI changes run: `pnpm check` and `pnpm build`.
- Verify key admin screens visually (login + dashboard) with Playwright screenshots in ignored artifacts directories.
- For local verification behind admin login, prefer the shared Playwright session `output/playwright/sessions/admin.local.json` and refresh it with `pnpm playwright:session:record -- --persona admin` if needed.
