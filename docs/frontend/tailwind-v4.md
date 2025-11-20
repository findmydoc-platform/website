# Tailwind v4 Migration & Guardrails

The frontend now runs on Tailwind CSS v4.1 using the CSS-first configuration in `src/app/(frontend)/globals.css`. This document combines the remaining migration plan with the guardrails we must keep once the migration is complete.

## 1. Migration Work Plan

Use this section as the running checklist while we finish removing legacy helpers and one-off workarounds.

### Current status

- Tailwind 4.1, `@tailwindcss/postcss`, typography plugin, and ESLint rules are live.
- `tailwind.config.mjs` has been deleted; `@source` directives in `globals.css` drive class discovery.
- Theme tokens, keyframes, and plugin registration already live in CSS (no JS config).

### Remaining tasks

1. **Audit globals** – convert any lingering raw units (`em`, `rem`, pixel fonts) into `@theme` tokens or Tailwind utilities to eliminate lint suppressions.
2. **Replace legacy containers** – search for `.container` and the React `Container` helper, swapping every instance for the shared pattern `mx-auto w-full max-w-7xl px-6 lg:px-8 2xl:max-w-360` (tune per component when necessary). Remove the helper component once unused.
3. **Normalize section shells** – ensure every `full-bleed` section wraps its inner content with the approved container spacing so headers, footers, admin bar, and blocks align.
4. **Intent utilities adoption** – confirm alert/toast components rely on `intent-*` and `text-intent-*` utilities instead of ad-hoc color classes.
5. **Typography review** – migrate `.prose` overrides and any bespoke heading sizes to theme tokens; document any sanctioned exceptions.
6. **UI kit sweep** – inspect `src/components/ui/**` for literal color/spacing values; replace with Tailwind tokens or define new entries in `@theme`.
7. **Hook/utility strings** – update hard-coded class strings in hooks (e.g., `useClickableCard`) to the new utilities so tests cover the final naming.
8. **Tests & linting** – after each batch, run `pnpm check`, `pnpm tests --project=unit`, and a smoke `pnpm build` to ensure no regressions.

### Verification checkpoints

- Manual visual QA on typography-heavy blocks, the grid-based `layout-span-*` sections, and any components previously relying on safelisted combos.
- When introducing a new directory that emits Tailwind classes, append another `@source` line in `globals.css` before committing.

## 2. Final State Guardrails (Strict Tailwind v4 Usage)

Once the tasks above are complete, keep these rules in force to stay fully aligned with Tailwind v4’s CSS-first model.

### Entry order

```css
@import 'tailwindcss';
@source '../../../../src/**/*.{ts,tsx,js,jsx,mdx}';
@source '../../../../tests/**/*.{ts,tsx,js,jsx,mdx}';
@source '../../../../scripts/**/*.{ts,tsx,js,jsx,mdx}';
@plugin '@tailwindcss/typography';
@theme inline { /* tokens */ }
```

- Keep `@import` first to satisfy the CSS lint rule.
- Register every new code directory via `@source` before relying on its classes.
- Add plugins with `@plugin` (no JS config files allowed).

### Theme tokens

- `@theme inline` replaces `theme.extend`. Define colors, fonts, radii, spacing, or animations here.
- When adding semantic colors, also expose them via CSS variables in the `:root` block so custom CSS and Tailwind utilities stay in sync.

### Custom utilities

- Layout spans: `.layout-span-{full|half|one-third|two-thirds}` rely on CSS variables—extend them instead of duplicating grid rules.
- `@utility full-bleed`, the shared container spacing, and intent utilities form the canonical patterns; avoid reintroducing bespoke helpers or safelists.
- Accordion animations live in `@utility animate-accordion-{up|down}`; add future animations with the same approach.

### Typography overrides

- The typography plugin customizations live under `@layer components`. Update `.prose`, `.prose-base`, and `.prose-md` selectors there, keeping values tied to theme tokens.

### Tooling & enforcement

- Shadcn UI’s `components.json` must keep `"config": null`; extend `globals.css` instead of resurrecting `tailwind.config.*`.
- ESLint is configured to understand Tailwind at-rules; leaving the CSS-first structure intact keeps linting and type-checking simple.
- When deviating from the 8-pt spacing scale, add a short code comment explaining why; otherwise expect lint failures.

Following this combined plan ensures we finish the migration methodically and, once complete, keep the project locked into Tailwind v4’s full potential without backsliding into legacy patterns.
