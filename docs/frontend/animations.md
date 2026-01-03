# Animation stack

## Overview
We use a lightweight, React-based animation stack that supports subtle motion and scroll-driven storytelling without scroll-jacking. Layout (grid + sticky) remains pure CSS, while animation and step activation are handled with dedicated libraries.

## Libraries
- **Motion** (`motion`, `motion/react`)
  - Use for component-level animations (fade, slide, hover, layout transitions).
  - Prefer declarative motion props and `useReducedMotion` for accessibility.
- **Scrollama** (`scrollama`)
  - Use for scroll-driven step activation (IntersectionObserver-based).
  - Keep it focused on detecting active steps and progress.
- **CSS Sticky**
  - Use `position: sticky` with a top offset for pinned visuals.
  - Avoid JavaScript-based pinning.

## Usage guidelines
1. Keep layout logic (grid, columns, sticky positioning) separate from animation logic.
2. Use Motion for transitions and reveal states only, not for scroll locking.
3. Use Scrollama only to determine active/revealed steps in storytelling sections.
4. Do not add smooth scrolling or scroll-jacking libraries.
5. Ensure reduced-motion support by disabling translations when `prefers-reduced-motion` is enabled.

## Upgrade path
Components should be structured so Motion and Scrollama can be replaced with GSAP + ScrollTrigger if higher complexity or timeline control is needed.
