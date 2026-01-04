import type { StorybookConfig } from '@storybook/react-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.mdx', '../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: '@storybook/react-vite',
  staticDirs: ['../public'],
  viteFinal: async (config) => {
    config.plugins?.push(tsconfigPaths())

    // Why this exists:
    // - CI runners have cold caches.
    // - If Vite decides to optimize dependencies during the test run, it reloads the page.
    // - That reload can make Vitest's browser runner fail (often with unrelated-looking errors).
    // Pre-bundling these avoids the mid-run optimize+reload.
    config.optimizeDeps ??= {}
    const include = (config.optimizeDeps.include as string[] | undefined) ?? []
    config.optimizeDeps.include = Array.from(new Set([...include, '@payloadcms/ui', '@storybook/addon-a11y']))

    return config
  },
}
export default config
