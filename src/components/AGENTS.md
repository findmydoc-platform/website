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
- Design component APIs so mobile state is explicit and testable; avoid hidden responsive behavior that cannot be previewed or asserted in isolation.
- Do not introduce hover-only interactions for essential actions or navigation.
- Avoid component layouts that depend on horizontal scrolling unless the component is explicitly a scrollable pattern and provides clear touch affordances.
- Keep touch targets, spacing, and text wrapping resilient at narrow widths before layering larger-screen enhancements.

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
- For responsive components, use the canonical mobile matrix from `docs/frontend/mobile-ai-playbook.md`; include the additional `1280px` check only when the playbook marks it as required.
- If a shared mobile component such as header, navigation, drawer, or sticky bar can affect multiple route types, pair component-level verification with composed-route checks on at least two representative routes or content densities.
- If a route-critical mobile component such as a filter sheet, sticky CTA, full-height dialog, or overlay can create runtime risk on the composed route, pair component-level verification with composed-route checks even when the component is not shared.

## Styling Protocol

- Tailwind CSS v4 + shadcn atoms (`src/components/atoms`).
- Keep component variants in code (CVA), not semantic global CSS classes.
- Avoid inline styles unless no other option exists.
- Use design tokens and utility composition before arbitrary values.
- Prefer mobile-first utilities and widen deliberately instead of patching desktop layouts downward.

## Heading Rule

- Use the `Heading` atom for headings.
- Do not introduce raw `h1`-`h6` in feature UI code.

## Data and Validation

- Business validation belongs in Payload hooks/access logic.
- Prefer server-side data fetching in App Router unless client reactivity is required.
- Review responsive components for CTA order and wrapping, sticky overlap, dialog or sheet height containment, and image `sizes` hints when media layout changes across breakpoints.
- For sheets, drawers, sticky bars, dialogs, fixed navigation, and full-height panels, apply the playbook short-height checks instead of inventing a local subset.
- When component layout depends on content shape, add at least one worst-case story or fixture covering long labels, dense CMS-like content, validation errors, empty states, loading states, or error states.
- When documenting runtime-sensitive mobile risks for a component, follow the playbook `Confirmed` versus `Likely` threshold instead of redefining it locally.
- For interactive mobile components, verify at least one full interaction cycle, not only a single click state, for example open/use/scroll/close, apply/clear/close, or invalid-submit/error/fix/submit.

## Animation Stack

- Default animation tooling: GSAP + ScrollTrigger.
- Sticky layout uses native CSS (`position: sticky`) with top offset.
- Avoid scroll-jacking libraries.
