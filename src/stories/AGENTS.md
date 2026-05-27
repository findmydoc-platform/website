# Storybook and UI Story Rules

## Priorities

- `P0`: Isolation and deterministic rendering.
- `P1`: Useful visual and interaction coverage.
- `P2`: Concise docs via Autodocs-first approach.

## Critical Story Rules

- Stories must not depend on live app state, real APIs, or navigation side effects.
- Use story-level props or decorators for local dependency injection.
- Story files must import test helpers from `storybook/test`, never from `@storybook/test`.
- Story files must not import `vitest`, call `vi.mock`, or call `sb.mock`.
- Storybook-only module mocks must be centralized through exact Vite aliases in `.storybook/main.ts` that point to root `__mocks__/` files.
- Vitest mocks are allowed only in Vitest setup or test files, not in Storybook story files.
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
- Import Storybook image assets only through `src/stories/fixtures/assets.ts`; stories and fixtures should use the semantic exports from that catalog.
- `https://placehold.co` is acceptable for lightweight placeholders when committed assets add no value.

## Interaction Coverage

- Add `play` assertions for key interactions and state transitions.
- Keep stories focused on existing component behavior.

## Contributor Checklist

- Story path mirrors atomic structure.
- Autodocs tag present.
- Story metadata complies with `docs/frontend/story-governance.md`.
- Local dependency injection is explicit; imported module mocks are centralized in Storybook Vite aliases.
- No external side effects.
- Story-related tests remain green.
