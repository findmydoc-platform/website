---
applyTo: 'src/stories/**/*'
---

# Storybook Instructions

## Priorities

- `P0`: Isolation and deterministic rendering.
- `P1`: Useful visual and interaction coverage.
- `P2`: Concise docs via Autodocs-first approach.

## Critical Rules

- Stories must not depend on live app state, real APIs, or navigation side effects.
- Mock missing dependencies in story scope (router/auth/fetch) when required.
- Keep stories compatible with Vitest Storybook runs.
- Story metadata must comply with `docs/frontend/story-governance.md`.
- Component registry artifacts must be kept current per `docs/frontend/component-registry.md`.

## Documentation Location

- Use Autodocs as default (`tags: ['autodocs']`).
- Add short component descriptions when helpful.
- Use MDX only for cross-cutting guidance, not per-component duplication.

## Assets

- Do not hotlink arbitrary external images.
- Prefer committed assets in `src/stories/assets/`.
- `https://placehold.co` is acceptable for lightweight placeholders when committed assets add no value.

## Interaction Coverage

- Add `play` assertions for key interactions and state transitions.
- Keep stories focused on existing component behavior.

## Contributor Checklist

- Story path mirrors atomic structure.
- Autodocs tag present.
- Story metadata complies with `docs/frontend/story-governance.md`.
- Mocks are local and explicit.
- No external side effects.
- Story-related tests remain green.
