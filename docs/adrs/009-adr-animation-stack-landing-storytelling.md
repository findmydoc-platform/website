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

We need a consistent animation stack for landing page interactions that supports subtle motion, scroll-driven storytelling, and accessibility requirements. The approach must avoid scroll-jacking, keep pinned visuals implemented with native CSS, and allow a future upgrade path to more advanced timeline tooling if needed.

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

- **Motion** (`motion` / `motion/react`) for component-level animation.
- **Scrollama** (`scrollama`) for scroll-driven step activation (IntersectionObserver-based).
- **CSS Sticky** (`position: sticky`) for pinned visuals.

**Rationale:**
- **Motion**: Provides a powerful and declarative API for animations in React, making it easy to manage animation states.
- **Scrollama**: A lightweight library for scroll detection that uses IntersectionObserver, avoiding the performance overhead of scroll event listeners. It is used only to determine active steps.
- **CSS Sticky**: Native CSS solution for pinned elements, ensuring smooth performance and reducing JavaScript dependency.

## Technical Debt

- **Future Complexity**: If animation requirements become very complex, we might need to migrate to GSAP + ScrollTrigger. The current components should be structured to allow this replacement if necessary.

## Alternatives Considered

1. **GSAP + ScrollTrigger**:
   - **Pros**: Industry standard for complex timelines.
   - **Cons**: Heavier bundle size, potential licensing costs for some features.
   - **Decision**: Deferred until needed. Current stack allows for future upgrade.

2. **Scroll-jacking libraries**:
   - **Pros**: Control over scroll behavior.
   - **Cons**: Poor user experience, accessibility issues.
   - **Decision**: Avoided to maintain native scroll feel.

## Risks

- **Complexity Management**: Ensuring that the separation between layout (CSS) and animation (JS) remains clean is essential to prevent spaghetti code.

## Superseded by (Optional)

N/A
