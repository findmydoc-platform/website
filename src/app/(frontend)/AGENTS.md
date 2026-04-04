# Frontend App Routes (Next.js + UI)

## Priorities

- `P0`: Correct architecture boundaries and accessibility.
- `P1`: Reliable, testable UI behavior.
- `P2`: Visual consistency and maintainable styling.

## Architecture Defaults

- Next.js App Router + RSC by default.
- Use `'use client'` only at interaction leaves.
- Keep atomic layering clear: atoms -> molecules -> organisms -> templates.

## Critical Rules

- Keep reusable atoms and molecules presentation-only.
- Do not place business logic or data fetching inside reusable UI components.
- Favor parent-controlled inputs (`value/onValueChange`, `checked/onCheckedChange`).
- Keep molecules router-agnostic; pass navigation callbacks as props.

## Boundary Reminder

- UI components stay Payload-free.
- Payload mapping belongs in `src/blocks/**` adapters.

## Storybook Expectations

- New or changed reusable UI components should include or update stories in `src/stories/**`.
- Keep stories isolated and deterministic.

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
- If frontend route changes alter user-facing flows documented in `docs/guides/**`, update the affected guide and refresh stale screenshots in the same change.

## Animation Stack

- Default animation tooling: GSAP + ScrollTrigger.
- Sticky layout uses native CSS (`position: sticky`) with top offset.
- Avoid scroll-jacking libraries.
