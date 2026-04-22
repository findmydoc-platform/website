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
- Start route and page composition from the narrow viewport first, then widen to tablet and desktop once hierarchy, spacing, and primary actions are stable.
- Prefer vertical flow, clear content priority, and compact CTA grouping over early multi-column density.
- Do not rely on hover-only disclosure, pointer-precision affordances, or side-by-side layouts that collapse into ambiguous mobile order.

## Boundary Reminder

- UI components stay Payload-free.
- Payload mapping belongs in `src/blocks/**` adapters.

## Storybook Expectations

- New or changed reusable UI components should include or update stories in `src/stories/**`.
- Keep stories isolated and deterministic.
- Use `docs/frontend/mobile-ai-playbook.md` when defining mobile states, viewport expectations, and responsive QA notes for route-level UI work.
- For route-level mobile work, verify the composed route directly; use Playwright or equivalent route-level runtime evidence for runtime-sensitive risks such as sticky overlap, drawers, sheets, filters, forms, or scroll containment, and use screenshots or route-level stories only as supporting evidence or for static layout checks.

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
- For local verification of authenticated admin-facing routes under `src/app/(frontend)/admin/**`, prefer the shared Playwright session `output/playwright/sessions/admin.local.json` instead of redoing login in each browser run.
- For route-level mobile work, apply the canonical mobile matrix from `docs/frontend/mobile-ai-playbook.md`; include the additional `1280px` check only when the playbook marks it as required.
- Review sticky headers, drawers, accordions, carousels, filter bars, and modal heights for touch reachability and scroll containment on small screens.
- When the route uses sticky CTAs, sticky bars, fixed navigation, drawers, sheets, dialogs, or full-height panels, apply the playbook short-height checks and name the reduced-height states you verified.
- When reporting route-level mobile verification, name the exact interaction cycles checked per viewport, for example open/use/scroll/close for mobile nav or drawers, apply/clear filters, or invalid-submit/error/fix/submit for forms.
- When shared mobile UI such as header, navigation, or sticky bars spans multiple route types, sample at least two representative routes or content densities.
- When route layout depends on real content shape, also verify at least one worst-case content state with long labels, dense CMS content, or empty/loading/error states.
- For image-heavy routes, verify composed-route image sizing and `sizes` assumptions at mobile widths instead of relying only on component-level checks.

## Animation Stack

- Default animation tooling: GSAP + ScrollTrigger.
- Sticky layout uses native CSS (`position: sticky`) with top offset.
- Avoid scroll-jacking libraries.
