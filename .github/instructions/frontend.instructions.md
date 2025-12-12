---
applyTo: "src/app/**/*.tsx,src/stories/**/*,src/components/**/*.tsx,src/app/(frontend)/globals.css"
---

# Frontend (Next.js + UI)

- **Framework**: Next.js App Router with React Server Components by default.
- **Client/Server**: Only use `'use client'` in leaf components that need interactivity (forms, buttons, client hooks), not in top-level pages or templates.
- **Structure**: Follow atomic structure: `atoms` → `molecules` → `organisms` → `templates` → `pages`. Detailed guidance lives in `docs/frontend/atomic-architecture.md`.
- **Atomic layers**:
    - Atoms: shadcn/ui primitives only. No business logic, no Payload types. Use `@/components/atoms/<component>` imports.
  - Molecules: light compositions (e.g., `UiLink`, `Pagination`, layout helpers). Must be Payload-free and side-effect free. Any Payload/CMS mapping belongs in `src/blocks/**` adapters (see `.github/instructions/cms-ui-boundary.instructions.md`). **Router-agnostic**: Must not use `useRouter` directly; accept navigation callbacks (e.g., `onNavigate`) via props.
    - Organisms: block/feature sections (`Card`, `Auth` forms, hero blocks). These are what Payload blocks render.
    - Templates: layout wrappers / shells that stitch organisms together and often run on the server (e.g., site header/footer frames, dashboard layouts).
    - Pages: reusable page assemblies, rarely needed; App Router still hosts route files under `src/app`.

## Component Architecture: Smart Shells & Dumb UI

1.  **Strict Separation**: Build "Dumb" (Presentational) components that rely *only* on props.
    *   **DO**: Pass data (`user`, `posts`) and actions (`onSave`, `onDelete`) as props.
    *   **DON'T**: Import `fetch`, `useRouter`, or database calls inside UI components (Atoms/Molecules).
2.  **Smart Shells**: Place logic, data fetching, and context usage in "Smart" containers (usually Next.js Pages, Layouts, or Organisms).
    *   These shells wrap Dumb components and feed them data.
3.  **Props > Context**: Avoid `useContext` for global state in reusable UI components. Pass values explicitly to ensure components are portable and easy to test in Storybook. (Exception: Compound Components using local context).

## UI Component Patterns (Strict)

For any component with multiple sub-parts or internal state (especially Molecules/Organisms), you must strictly follow the **Compound Component (Headless)** pattern.

### 0. Rule of Thumb: Monolith vs. Compound
- **Monolith Pattern (Default)**: Use simple functional components accepting a `data` prop (e.g., `Page['hero']`) for simple UI and CMS blocks (like Heroes).
- **Compound Pattern (Complex)**: Switch to Composition only when you find yourself passing `isSomething={true}` for the 3rd time ("Rule of 3 Booleans"). If a component has 3+ conditional props, refactor to Compound.

### 1. Structure Requirements
- **Never** build a monolithic component that uses boolean props to toggle UI sections (e.g., `showFooter`, `isEditMode`).
- **Always** break the component into sub-parts (e.g., `Root`, `Header`, `Content`).
- **Always** use a React Context (`createContext`) to share state between these sub-parts if they need to communicate.
- **Always** export a custom hook (e.g., `useCardContext`) to allow sub-components to access state.
- **Always** export the component as a Namespace Object (e.g., `export const Card = { Root, Header, ... }`) to enforce dot-notation usage (`<Card.Root>`).

### 2. API Design (Inversion of Control)
- The `Root` component must accept `children`.
- Do not hardcode layout inside the `Root`. The consumer of the component decides the order of sub-components.
- If a sub-component needs to be hidden, the consumer should simply *not render it*, rather than passing a `hidden` prop.

### 3. Styling & Props
- All sub-components must accept a `className` prop for Tailwind overrides.
- Use `clsx` or `tailwind-merge` (via `cn` utility) to merge default styles with user styles.
- Keep the logic (state/handlers) separate from the markup as much as possible.

### 4. Implementation Example
Do not deviate from this pattern:

```tsx
import { createContext, useContext } from 'react'
import { cn } from '@/utilities/ui'

// 1. Context
const ComponentContext = createContext<State | null>(null)

// 2. Sub-components
const Root = ({ children, ...props }) => {
  return (
    <ComponentContext.Provider value={props}>
      <div className="base-styles">{children}</div>
    </ComponentContext.Provider>
  )
}

const Item = ({ className, children }) => {
  const ctx = useContext(ComponentContext)
  return <div className={cn('item-style', className)}>{children}</div>
}

// 3. Namespace Export
export const Component = {
  Root,
  Item,
}
```

## Storybook

- Storybook coverage is mandatory: every new or updated UI component must ship with a matching story under the corresponding atomic folder in `src/stories` before merging.
- Stories live under `src/stories` and mirror the atomic folders; set each story `title` (e.g., `Atoms/Button`) to keep the sidebar ordered.
- Do **not** colocate stories beside components; all stories live exclusively under the shared `src/stories` tree so Storybook structure stays consistent.
- Import components and atoms via the existing `@/...` aliases so Storybook and Next.js stay in sync.
- Rely on shared globals imported in `.storybook/preview.ts` for Tailwind and fonts; do not re-import CSS per story.
- Storybook runs in light mode only and should focus on presentational coverage (no business logic).
- **See `.github/instructions/stories.instructions.md` for detailed Storybook rules and Vitest expectations.**
- **Blocks**: Payload block `slug` must match the organism/component name used to render it. Each block should import from `@/components/organisms/<BlockSlug>`.
- **Shadcn atoms**: All shadcn/ui primitives live under `src/components/atoms`; import them with the `@/components/atoms/<component>` alias (never `@/components/ui`). When running the shadcn CLI, ensure `components.json` still maps the `components` alias to this atoms folder so new primitives land there automatically, and keep variants in the generated atom file using CVA.
- **Aliases**: `tsconfig.json` exposes `@/components/{atoms|molecules|organisms|templates|pages}`. Use these instead of deep relative paths and update aliases/docs if you add new layers.

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
