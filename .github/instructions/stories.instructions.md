---
applyTo: 'src/stories/**/*'
---

# Storybook Instructions

These rules apply to all Storybook stories (`*.stories.tsx`) and ensure they are robust, isolated, and testable via Vitest.

## Core Principles

1.  **Isolation First**: Stories must render components in complete isolation. Do not rely on the Next.js App Router, Auth Providers, or global app state unless explicitly mocked within the story.
2.  **No Side Effects**: Stories should not trigger real API calls, database mutations, or navigation.
3.  **Visual & Interaction Testing**: Use stories to verify UI states (loading, error, empty) and interactions (clicks, form input) via the `play` function.

## Implementation Rules

### Documentation Location (ADR-013)

This repository follows **ADR-013: Storybook Documentation Location** (see `docs/adrs/013-adr-storybook-documentation-location.md`).

**Autodocs-First Approach:**

- **Primary documentation** lives in story files via Autodocs. Stories must include the `autodocs` tag in their `tags` array (for example, `tags: ['autodocs']`).
- All stories **must** include the `autodocs` tag in their `tags` array to enable automatic documentation generation.
- Add a short component description via `parameters.docs.description.component` when it helps clarify the component's purpose or key behaviors.
- Keep descriptions concise (1-3 sentences). Example:
  ```tsx
  const meta = {
    title: 'Atoms/Button',
    component: Button,
    tags: ['autodocs'],
    parameters: {
      docs: {
        description: {
          component:
            'Primary interactive element for user actions. Supports multiple variants and sizes for different contexts.',
        },
      },
    },
  } satisfies Meta<typeof Button>
  ```

**When to Use MDX:**

- **Use Storybook MDX docs** only for cross-cutting guidance, complex workflows, or narrative explanations that do not fit inside Autodocs.
- Examples: design system patterns, compound component usage guides, accessibility best practices across multiple components.
- Do **NOT** create MDX files for individual component documentation—use story metadata instead.

**Repository Docs:**

- **Use repository docs** (like ADRs in `docs/adrs/`) only for system-wide decisions or infra-level guidance.
- Do **NOT** duplicate component documentation in repository markdown files.

### 0. Images / Assets (Required)

- **Never hotlink images** (no `http(s)://...` URLs) from Storybook stories. Stories must be deterministic and work offline/CI.
  - Exception: small placeholder images from `https://placehold.co` are permitted as inline URLs for quick placeholders; prefer downloading and committing assets to `src/stories/assets/` for determinism in CI.
- **When a story needs an image**, download it and commit it into `src/stories/assets/` (same location/pattern as `src/stories/organisms/FeatureHero.stories.tsx`).
- **Source**: Images must be taken from https://unsplash.com/.
  - Prefer downloading from `images.unsplash.com` and committing the file (e.g., `jpg`), rather than linking directly.
  - Keep files reasonably sized (e.g., ~1600px wide) so the repo and tests stay fast.
  - Import the local asset and pass it via props (example: `import hero from '../assets/medical-hero.jpg'`).
  - Allowed placeholders: `https://placehold.co` may be used for ephemeral placeholders when committing an asset is unnecessary, but prefer committing local assets where possible.
  - Downloaded placeholder files MUST be PNG, visually good quality, and follow the filename pattern `placeholder-<width>-<height>.png` (for example `placeholder-1440-768.png`). Place downloaded files into `src/stories/assets/` and import them in stories.

### 1. Routing & Navigation

- **Do NOT** expect `useRouter` or `usePathname` to work.
- **DO** mock navigation by passing no-op or logging functions to component props (e.g., `onNavigate={() => {}}`).
- If a component strictly requires a router (e.g., `Link` components), use a Storybook decorator to provide a mock context, but prefer refactoring the component to accept `href` or `onClick` props.

### 2. Data & State

- **Props over Context**: Control component state via `args`. Avoid components that fetch their own data inside a story.
- **Mocking**: If a component relies on a context (e.g., `ThemeContext`), wrap the story in a decorator that provides a static value for that context.

### 3. Interaction Tests (`play` function)

- Use the `play` function to simulate user behavior.
- Assert UI changes using `expect` from `@storybook/test`.
- Example:
  ```tsx
  export const Interactive: Story = {
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement)
      await userEvent.click(canvas.getByRole('button'))
      await expect(canvas.getByText('Success')).toBeInTheDocument()
    },
  }
  ```

### 4. File Structure

- Mirror the `src/components` structure: `src/stories/atoms`, `src/stories/molecules`, etc.
- Title stories clearly: `title: 'Molecules/Pagination'`.

## Vitest Compatibility

- Stories are run as tests via `pnpm tests`.
- Any story that crashes because of missing providers (Router, QueryClient) is considered a **failed test**.
- Fix failures by mocking the missing dependency in the story, NOT by adding the provider to the global test setup.

## Contributor Checklist (PR Reviews)

When creating or updating stories, ensure:

- [ ] Story includes `autodocs` tag in the tags array for automatic documentation
- [ ] Story metadata includes a concise description via `parameters.docs.description.component` (1-3 sentences) when it clarifies component purpose
- [ ] Story title follows atomic structure: `Atoms/`, `Molecules/`, `Organisms/`, `Templates/`
- [ ] Stories are isolated—no real API calls, navigation, or external dependencies
- [ ] Images/assets are committed to `src/stories/assets/` (no hotlinked URLs except `placehold.co` for ephemeral placeholders)
- [ ] Interactive behaviors are covered by `play()` functions with assertions
- [ ] Mock decorators are used for routing, auth, and fetch when needed
- [ ] Component business logic and visuals remain unchanged (stories only document existing behavior)
- [ ] Tests pass: `pnpm tests` (stories run as Vitest tests)

**Reference**: See [ADR-013](../../docs/adrs/013-adr-storybook-documentation-location.md) for full documentation location guidelines.
