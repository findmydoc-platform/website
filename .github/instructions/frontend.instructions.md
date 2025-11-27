---
applyTo: "src/app/**/*.tsx,src/components/**/*.tsx,src/app/(frontend)/globals.css"
---

# Frontend (Next.js + UI)

- **Framework**: Next.js App Router with React Server Components by default.
- **Client/Server**: Only use `'use client'` in leaf components that need interactivity (forms, buttons, client hooks), not in top-level pages or templates.
- **Structure**: Follow atomic structure: `atoms` → `molecules` → `organisms` → `templates` → `pages`.
- **Blocks**: Payload block `slug` must match the organism/component name used to render it.
- **Shadcn atoms**: All shadcn/ui primitives live under `src/components/atoms`; import them with the `@/components/atoms/<component>` alias (never `@/components/ui`). When running the shadcn CLI, ensure `components.json` still maps the `components` alias to this atoms folder so new primitives land there automatically.

## Styling Architecture (Strict)

- **Stack**: Use **Tailwind CSS v4** and **shadcn/ui**.
- **Component Styles**: Strictly use **CVA (Class Variance Authority)** for component variants.
    - **Rule**: Do **NOT** extract component styles to Global CSS using `@apply` or custom semantic classes (e.g., `.btn-primary`, `.card-wrapper`).
    - **Reasoning**: Styles must remain colocated with JSX for type safety and maintainability.
- **Atomic Utilities**: Use the CSS `@utility` directive *only* for small, generic composition shortcuts (e.g., `@utility flex-center`) that are not tied to specific business components.

### Refusal Triggers (Policing `globals.css`)
- **IF** the user or agent attempts to add semantic classes like `.intent-success`, `.shell-base`, or `.card-layout` to `globals.css`:
    - **STOP**. Refuse the generation.
    - **Action**: Instruct to move this logic into a React Component (e.g., `<Shell>`, `<Badge>`) using CVA variants instead.

## Tailwind CSS v4 Strict Protocol

### 1. Core Configuration
- **CSS-First Config**: Do **NOT** create `tailwind.config.js`. All configuration (colors, fonts, breakpoints) must reside in `src/app/(frontend)/globals.css` using the `@theme` directive.
- **Source Scanning**: Use `@source` directives in CSS to control file scanning; do not rely on implicit content detection.
- **Light Mode Only**: Do **NOT** generate `dark:` classes, configurations, or toggle logic. The application is strictly Light Mode.
- **Variables**: Define all design tokens as native CSS variables inside `@theme` (e.g., `--color-brand: #123;`).

### 2. Arbitrary Values (`[...]`)
- **The "Design System" Rule (Forbidden)**: Do **NOT** use arbitrary values for primary styling tokens.
    - *Forbidden:* `text-[#123456]`, `font-[16px]`, `gap-[13px]`.
    - *Action:* These must be defined as variables in `@theme` to ensure consistency.
- **The "External Constraint" Exception (Allowed)**: You may use arbitrary values *only* for pixel-perfect positioning forced by external libraries or assets (e.g., `top-[64px]` for a sticky header, `z-[100]` for overlays).
- **Justification Requirement**: If you use `[...]`, you must output a comment in the code explaining *why* the theme variables were insufficient.
- **Refactoring**: If an arbitrary value is used >2 times, you must refactor it into a `@theme` variable or `@utility`.

### 3. Responsiveness & Layout
- **Mobile-First Strictness**: Write base classes for **mobile** first. Use breakpoints (`sm:`, `md:`, `lg:`) *only* to override for larger screens.
    - *Bad:* `sm:text-center` (implies mobile styling is broken or accidental).
    - *Good:* `text-center md:text-left`.
- **Fluid Typography**: Prioritize fluid values (e.g., `text-[min(5vw,40px)]`) over creating multiple breakpoint classes for simple font resizing.
- **Layout System**: Use a 12-column grid (`grid-cols-12`) for page structures. Use 8-point grid spacing tokens (e.g., `p-4` = 16px) instead of arbitrary pixels.

### 4. Syntax & State Management
- **Native Modifiers**: Prefer native CSS/Tailwind modifiers over complex React state for UI interactions:
    - `open:` for `<details>`/`<summary>`.
    - `file:` for file inputs.
    - `accent-` for checkboxes/radios.
    - `group-*` / `peer-*` for parent/sibling dependent states.
    - `**:` variant for descendant selectors instead of complex arbitrary groups.
- **No Inline Styles**: Never use `style={{ ... }}`. If a dynamic value is needed, use Tailwind's arbitrary value syntax with a justification.

## Data & Validation
- Do not add client-side business validation; business rules belong in Payload hooks and access utilities.
- When fetching data in the App Router, prefer Server Components and Route Handlers over client-side fetching (useEffect/SWR) unless strictly necessary for live updates.

## Brand
- Use the product name `findmydoc` (lowercase) consistently in user-facing text, headings, and CTAs unless a different name is explicitly required.
