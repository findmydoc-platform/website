# ADR: Animation Stack for Landing Storytelling

## Status (Table)

| Name    | Content    |
| ------- | ---------- |
| Author  | Sebastian Schütze       |
| Version | 1.0        |
| Date    | 03.01.2026 |
| Status  | approved   |

## Background

The landing page requires engaging storytelling elements that rely on scroll interactions and animations. To ensure a high-quality user experience, these animations must be performant, accessible, and maintainable.

## Problem Description

We need a consistent animation stack for landing page interactions that supports subtle motion, scroll-driven storytelling, and accessibility requirements. The approach must avoid scroll-jacking, keep pinned visuals implemented with native CSS, and provide robust timeline control tied to SVG path geometry.

## Considerations

### Performance
Animations should not degrade page performance. Using native CSS where possible and efficient JavaScript libraries is crucial.

### Accessibility
Motion should respect user preferences, specifically `prefers-reduced-motion`. Scroll-jacking should be avoided to maintain expected browser behavior.

### Maintainability
The stack should be easy to use and integrate with React components. Layout logic should be kept separate from animation logic.

### Native CSS
Prefer native CSS features like `position: sticky` over JavaScript-heavy solutions for layout to ensure smooth performance.

## Decision with Rationale

Adopt the following stack:

- **GSAP** (`gsap`) for component-level animation and timeline control.
- **ScrollTrigger** (`gsap/ScrollTrigger`) for scroll-driven activation and progress tracking.
- **CSS Sticky** (`position: sticky`) for pinned visuals.

**Rationale:**
- **GSAP**: Provides a unified, timeline-first API that is well suited for synchronizing SVG path drawing, dot reveals, label transitions, and image crossfades.
- **ScrollTrigger**: Keeps scroll-driven animations reversible and in sync with section progress without custom scroll listeners.
- **CSS Sticky**: Native CSS solution for pinned elements, ensuring smooth performance and reducing JavaScript dependency.

## Technical Debt

- **Bundle Size**: GSAP adds weight; ensure only required plugins are loaded and keep animations scoped.

## Alternatives Considered

1. **Motion + Scrollama**:
   - **Pros**: Declarative API for simple component animation with lightweight step detection.
   - **Cons**: Harder to keep SVG path-driven animations, dot reveals, labels, and image crossfades in a single timeline.
   - **Decision**: Replaced by GSAP + ScrollTrigger for unified timeline control.

2. **Scroll-jacking libraries**:
   - **Pros**: Control over scroll behavior.
   - **Cons**: Poor user experience, accessibility issues.
   - **Decision**: Avoided to maintain native scroll feel.

## Risks

- **Complexity Management**: Ensuring that the separation between layout (CSS) and animation (JS) remains clean is essential to prevent spaghetti code.

## Superseded by (Optional)

N/A
