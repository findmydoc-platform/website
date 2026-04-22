# Storybook and UI Story Rules

## Priorities

- `P0`: Isolation and deterministic rendering.
- `P1`: Useful visual and interaction coverage.
- `P2`: Concise docs via Autodocs-first approach.

## Critical Story Rules

- Stories must not depend on live app state, real APIs, or navigation side effects.
- Mock missing dependencies in story scope (router/auth/fetch) when required.
- Keep stories compatible with Vitest Storybook runs.
- Story metadata must comply with `docs/frontend/story-governance.md`.
- Use `docs/frontend/mobile-ai-playbook.md` as the canonical source for the mobile matrix, short-height checks, and `Confirmed` versus `Likely` thresholds.
- For interactive mobile patterns, add `play` assertions for at least one full interaction cycle, not only a single open state.
- Treat stories as supporting evidence for route-level runtime risks; use composed-route runtime verification to confirm those risks.

## Frontend Consistency Rules

- Keep atoms and molecules presentation-only.
- Do not place business logic or data fetching inside reusable UI components.
- Keep molecules router-agnostic; pass navigation callbacks as props.
- Use the `Heading` atom for headings.
- Do not introduce raw `h1`-`h6` in feature UI code.

## UI and Payload Boundary Rules

- `src/components/**` must stay Payload-free.
- Do not import `@/payload-types` in atoms/molecules/organisms/templates.
- Normalize Payload unions in `src/blocks/**` or `src/blocks/_shared/**`.
- Compute CMS-derived routes in adapters, not presentational components.

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
