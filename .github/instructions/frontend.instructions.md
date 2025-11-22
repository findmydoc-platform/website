---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx"
---

# Frontend (Next.js + UI)

- Framework: Next.js App Router with React Server Components by default.
- Only use `'use client'` in leaf components that need interactivity (forms, buttons, client hooks), not in top-level pages or templates.
- Follow atomic structure: atoms → molecules → organisms → templates → pages; keep basic primitives in `atoms`, small compositions in `molecules`, page-level or block-mapped components in `organisms` and `templates`.
- Blocks: Payload block `slug` must match the organism/component name used to render it (see `src/blocks/RenderBlocks.tsx` and `src/components/organisms/**`).
- Styling: use Tailwind CSS v4 (CSS-first configuration) and shadcn/ui. Prefer extending shadcn components via CVA variants instead of thin wrapper components.
- Tailwind v4 Specifics:
  - Do NOT use `tailwind.config.js` or `theme.extend` in JavaScript. Define all theme tokens, keyframes, and variants directly in CSS using `@theme` and `@plugin`.
  - Use `@source` directives in CSS to control file scanning; do not rely on implicit content detection if isolation is required.
  - Use native CSS variables for values that need to be shared between Tailwind and external scripts/styles.
  - Prefer the new `@utility` directive for creating custom utilities instead of `@layer utilities`.
  - Use `@custom-variant` for complex selectors (e.g., `dark:`) instead of plugins.
  - **Syntax**: Use the `**:` variant for descendant selectors (e.g., `**:[[data-foo]]:opacity-50`) instead of complex arbitrary groups like `[&_...]`.
  - **Variables**: Use explicit `[var(--name)]` syntax for arbitrary values (e.g., `h-[var(--header-height)]`) to avoid ambiguity.
- For page-level layouts, prefer Tailwind grid utilities (`grid`, `grid-cols-12`, `col-span-*`) over ad-hoc `flex`/`w-*` combinations to implement the 12-column grid consistently.
- Layout system: use a 12-column grid for layout structure and an 8-point spacing system as the default for paddings, margins, and gaps. Follow industry guidance that 8px increments are the primary spacing units (for example, UCLA and other “soft 8-point grid” design systems) and only use 4px half-steps when absolutely necessary and clearly beneficial.
- Spacing rules: do not use arbitrary Tailwind spacing values such as `mt-[13px]` or `gap-[7px]`. Use only the spacing tokens defined in Tailwind (aligned to the 8-point system) and, in rare cases, 4px half-steps when you can explain why a smaller adjustment is needed (e.g., icon–label alignment).
- Typography: use Tailwind’s typography tokens (`text-*`, `leading-*`) instead of custom pixel values like `text-[17px]` or `leading-[21px]`. It is acceptable to be slightly flexible with line-height and font size for readability, but whenever deviating from a strict 8px rhythm, explain in the prompt or code context why this improves legibility or hierarchy.
- Brand: use the product name `findmydoc` (lowercase) consistently in user-facing text, headings, and CTAs unless a different name is explicitly required.
- Do not add client-side business validation; any business rules belong in Payload hooks and access utilities.
- When fetching data in the app router, prefer server components and route handlers over client-side data fetching.
