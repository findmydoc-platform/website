import type { StorybookConfig } from '@storybook/nextjs-vite'
import { createRequire } from 'node:module'
import tsconfigPaths from 'vite-tsconfig-paths'

const require = createRequire(import.meta.url)

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

    // Next's compiled React shim does not always include all React subpath exports.
    // `@payloadcms/ui` (and potentially other deps) import `react/compiler-runtime`.
    // Ensure that subpath resolves to the real React export to avoid Vite optimize errors.
    const reactCompilerRuntime = require.resolve('react/compiler-runtime')
    config.resolve ??= {}
    const existingAlias = config.resolve.alias
    if (!existingAlias) {
      config.resolve.alias = { 'react/compiler-runtime': reactCompilerRuntime }
    } else if (Array.isArray(existingAlias)) {
      existingAlias.push({ find: 'react/compiler-runtime', replacement: reactCompilerRuntime })
    } else {
      config.resolve.alias = {
        ...(existingAlias as Record<string, string>),
        'react/compiler-runtime': reactCompilerRuntime,
      }
    }

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

    return config
  },
}
export default config
