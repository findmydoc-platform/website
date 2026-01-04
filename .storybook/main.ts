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

    // CI runs start with cold Vite caches. If Storybook/Vitest discovers new deps
    // during the test run, Vite may optimize and reload, which can make Vitest
    // browser tests flaky. Pre-bundle key deps up-front.
    config.optimizeDeps = {
      ...(config.optimizeDeps ?? {}),
      include: Array.from(
        new Set([
          ...((config.optimizeDeps?.include as string[] | undefined) ?? []),
          '@payloadcms/ui',
          '@storybook/addon-a11y',
        ]),
      ),
    }

    return config
  },
}
export default config
