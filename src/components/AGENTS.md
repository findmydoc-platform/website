# Frontend Components (Next.js + UI)

## Priorities

- `P0`: Correct architecture boundaries and accessibility.
- `P1`: Reliable, testable UI behavior.
- `P2`: Visual consistency and maintainable styling.

## Architecture Defaults

- Next.js App Router + RSC by default.
- Use `'use client'` only at interaction leaves.
- Keep atomic layering clear: atoms -> molecules -> organisms -> templates.

## Critical Component Rules

- Keep atoms and molecules presentation-only.
- Do not place business logic or data fetching inside reusable UI components.
- Favor parent-controlled inputs (`value/onValueChange`, `checked/onCheckedChange`).
- Use context only for local compound-component coordination when necessary.
- Keep molecules router-agnostic; pass navigation callbacks as props.

## Boundary Rules

- `src/components/**` must stay Payload-free.
- Do not import `@/payload-types` in atoms/molecules/organisms/templates.
- Normalize Payload unions (links/media/relations) in `src/blocks/**` or `src/blocks/_shared/**`.
- Compute CMS-derived routes in adapters, not presentational components.
- If a component needs Payload imports, move mapping to a block adapter and pass normalized props into the UI layer.

## Storybook Expectations

- New or changed UI components must include or update stories in `src/stories/**`.
- Keep stories isolated and deterministic.
- Follow detailed story rules in `.github/instructions/stories.instructions.md`.
- Story metadata must follow `docs/frontend/story-governance.md`.

## Styling Protocol

- Tailwind CSS v4 + shadcn atoms (`src/components/atoms`).
- Keep component variants in code (CVA), not semantic global CSS classes.
- Avoid inline styles unless no other option exists.
- Use design tokens and utility composition before arbitrary values.

## Heading Rule

- Use the `Heading` atom for headings.
- Do not introduce raw `h1`-`h6` in feature UI code.

## Data and Validation

- Business validation belongs in Payload hooks/access logic.
- Prefer server-side data fetching in App Router unless client reactivity is required.

## Animation Stack

- Default animation tooling: GSAP + ScrollTrigger.
- Sticky layout uses native CSS (`position: sticky`) with top offset.
- Avoid scroll-jacking libraries.
