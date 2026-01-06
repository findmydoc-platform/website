// Storybook-specific shims for side-effect style imports.
// This keeps TypeScript happy when importing global CSS from `.storybook/preview.tsx`.

declare module '*.css' {
  const content: string
  export default content
}
