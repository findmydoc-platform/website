import type { StorybookConfig } from '@storybook/nextjs-vite'
import tsconfigPaths from 'vite-tsconfig-paths'

const config: StorybookConfig = {
  stories: ['../src/stories/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: [
    '@chromatic-com/storybook',
    '@storybook/addon-vitest',
    '@storybook/addon-a11y',
    '@storybook/addon-docs',
    '@storybook/addon-onboarding',
  ],
  framework: '@storybook/nextjs-vite',
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
    config.optimizeDeps.include = Array.from(
      new Set([...include, '@payloadcms/ui', '@storybook/addon-a11y', 'react/compiler-runtime']),
    )

    // `next/font/*` is ESM and can break when Vite pre-bundles it with CJS interop.
    // The symptom is a runtime crash like:
    // "does not provide an export named 'default'".
    const exclude = (config.optimizeDeps.exclude as string[] | undefined) ?? []
    config.optimizeDeps.exclude = Array.from(new Set([...exclude, 'next/font/google', 'next/font/local']))

    // Configure manual chunking to reduce large chunk sizes in static builds.
    // Split large vendor libraries and Storybook dependencies into separate chunks.
    config.build ??= {}
    config.build.rollupOptions ??= {}
    config.build.rollupOptions.output ??= {}
    const existingOutput = config.build.rollupOptions.output
    const outputArray = Array.isArray(existingOutput) ? existingOutput : [existingOutput]

    outputArray.forEach((output) => {
      output.manualChunks = (id: string) => {
        // Split large testing/docs libraries
        if (id.includes('node_modules')) {
          if (id.includes('@storybook/blocks') || id.includes('@storybook/components')) {
            return 'storybook-docs'
          }
          if (id.includes('react-syntax-highlighter')) {
            return 'syntax-highlighter'
          }
          if (id.includes('axe-core')) {
            return 'axe-core'
          }
          if (id.includes('date-fns')) {
            return 'date-fns'
          }
          if (id.includes('@vitest')) {
            return 'vitest-browser'
          }
        }
        return undefined
      }
    })

    return config
  },
}
export default config
