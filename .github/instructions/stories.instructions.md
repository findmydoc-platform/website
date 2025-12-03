---
applyTo: "src/stories/**/*,src/components/**/*.tsx"
---

# Storybook Instructions

These rules apply to all Storybook stories (`*.stories.tsx`) and ensure they are robust, isolated, and testable via Vitest.

## Core Principles

1.  **Isolation First**: Stories must render components in complete isolation. Do not rely on the Next.js App Router, Auth Providers, or global app state unless explicitly mocked within the story.
2.  **No Side Effects**: Stories should not trigger real API calls, database mutations, or navigation.
3.  **Visual & Interaction Testing**: Use stories to verify UI states (loading, error, empty) and interactions (clicks, form input) via the `play` function.

## Implementation Rules

### 1. Routing & Navigation
- **Do NOT** expect `useRouter` or `usePathname` to work.
- **DO** mock navigation by passing no-op or logging functions to component props (e.g., `onNavigate={() => {}}`).
- If a component strictly requires a router (e.g., `Link` components), use a Storybook decorator to provide a mock context, but prefer refactoring the component to accept `href` or `onClick` props.

### 2. Data & State
- **Props over Context**: Control component state via `args`. Avoid components that fetch their own data inside a story.
- **Mocking**: If a component relies on a context (e.g., `ThemeContext`), wrap the story in a decorator that provides a static value for that context.

### 3. Interaction Tests (`play` function)
- Use the `play` function to simulate user behavior.
- Assert UI changes using `expect` from `@storybook/jest` (or compatible library).
- Example:
  ```tsx
  export const Interactive: Story = {
    play: async ({ canvasElement }) => {
      const canvas = within(canvasElement);
      await userEvent.click(canvas.getByRole('button'));
      await expect(canvas.getByText('Success')).toBeInTheDocument();
    },
  };
  ```

### 4. File Structure
- Mirror the `src/components` structure: `src/stories/atoms`, `src/stories/molecules`, etc.
- Title stories clearly: `title: 'Molecules/Pagination'`.

## Vitest Compatibility
- Stories are run as tests via `pnpm tests`.
- Any story that crashes because of missing providers (Router, QueryClient) is considered a **failed test**.
- Fix failures by mocking the missing dependency in the story, NOT by adding the provider to the global test setup.
