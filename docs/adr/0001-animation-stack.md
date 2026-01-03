# ADR 0001: Animation stack for landing storytelling

## Status
Accepted

## Context
We need a consistent animation stack for landing page interactions that supports subtle motion, scroll-driven storytelling, and accessibility requirements. The approach must avoid scroll-jacking, keep pinned visuals implemented with native CSS, and allow a future upgrade path to more advanced timeline tooling if needed.

## Decision
Adopt the following stack:
- **Motion** (`motion` / `motion/react`) for component-level animation.
- **Scrollama** (`scrollama`) for scroll-driven step activation (IntersectionObserver-based).
- **CSS Sticky** (`position: sticky`) for pinned visuals.

## Consequences
- Scroll-driven storytelling sections should use Scrollama only to determine active steps, while Motion handles the animation states.
- Layout logic (grid, sticky positioning) remains separate from animation logic.
- No smooth scrolling or scroll-jacking libraries should be introduced.
- If more complex timelines are required later, components should be structured to allow replacement with GSAP + ScrollTrigger.
