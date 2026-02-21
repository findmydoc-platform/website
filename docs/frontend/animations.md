# Animation stack

## Overview
We use a GSAP-based animation stack that supports subtle motion and scroll-driven storytelling without scroll-jacking. Layout (grid + sticky) remains pure CSS, while animation and step activation are handled in GSAP timelines/triggers.

## Libraries
- **GSAP** (`gsap`)
  - Use for component-level and timeline-based animations.
  - Keep reveal transitions and sequencing in one timeline where possible.
- **ScrollTrigger** (`gsap/ScrollTrigger`)
  - Use for scroll-driven activation and progress synchronization.
  - Keep it focused on activation/progress logic, not layout pinning.
- **CSS Sticky**
  - Use `position: sticky` with a top offset for pinned visuals.
  - Avoid JavaScript-based pinning.

## Usage guidelines
1. Keep layout logic (grid, columns, sticky positioning) separate from animation logic.
2. Use GSAP timelines for transitions and reveal states only, not for scroll locking.
3. Use ScrollTrigger to determine active/revealed steps in storytelling sections.
4. Do not add smooth scrolling or scroll-jacking libraries.
5. Ensure reduced-motion support by disabling translations when `prefers-reduced-motion` is enabled.

## Upgrade path
Components should be structured so animation logic can evolve without coupling layout and trigger geometry.

## GSAP + ScrollTrigger (scrollytelling exception)
In a few cases (e.g. SVG path drawing synced to scroll), GSAP + ScrollTrigger is an acceptable choice.

`LandingProcess` uses GSAP + ScrollTrigger to:
- animate an SVG path (stroke-dashoffset) in sync with scroll
- reveal dots/labels and swap images as the scroll progress advances

### Tuning the curve
Use the `curve` prop to control geometry and visuals:
- `pathD` + `viewBox`: define the curve shape and coordinate system
- `labelOffsetPx`: nudge label placement relative to each dot
- `curveClassName` / `dotClassName`: control curve + dot colors via Tailwind classes

### Custom step placement
Use `stepProgresses` (values from 0..1, aligned with `steps`) to control where each dot lands along the path.
These values also become the scroll activation thresholds, so the reveal timing matches the geometry.

Use `labelProgresses` when you want labels (step headers + copy) to land at slightly different positions than the dots while keeping scroll activation driven by `stepProgresses`.

For scroll pacing, you can adjust the spacer heights between steps with either:
- `stepTriggerClassNames` (per-instance) or
- `curve.stepTriggerClassNames` (preset default)

These class arrays the same length as `steps` allow fine-grained control over how much viewport-relative scroll space sits between each step while keeping layout CSS-only.
