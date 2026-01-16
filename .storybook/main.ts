import type { StorybookConfig } from '@storybook/nextjs-vite'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
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

    // Storybook browser preview can crash when stories import `expect` from
    // `@storybook/jest` (it relies on Vitest/Jest internals being initialized).
    // We shim it to `@storybook/test` for runtime safety.
    config.resolve ??= {}
    const jestShimPath = fileURLToPath(new URL('./storybook-jest-shim.ts', import.meta.url))
    if (Array.isArray(config.resolve.alias)) {
      config.resolve.alias.push({ find: '@storybook/jest', replacement: jestShimPath })
    } else {
      config.resolve.alias = {
        ...(config.resolve.alias as Record<string, string>),
        '@storybook/jest': jestShimPath,
      }
    }

    // Strip "use client" directives for Storybook compatibility.
    // These Next.js-specific directives cause Vite build errors:
    // "Module level directives cause errors when bundled"
    config.plugins?.push({
      name: 'remove-use-client',
      transform(code, id) {
        if (/\.(tsx?|jsx?|mjs)$/.test(id)) {
          // Match 'use client' or "use client" with optional semicolon and trailing whitespace
          const transformedCode = code.replace(/'use client';?\s*|"use client";?\s*/g, '')
          return {
            code: transformedCode,
            map: null,
          }
        }
        return undefined
      },
    })

    // Ensure react/compiler-runtime resolves to the real React package
    // to avoid issues with Next.js's compiled React shim.
    try {
      const require = createRequire(import.meta.url)
      const reactCompilerRuntime = require.resolve('react/compiler-runtime')
      if (Array.isArray(config.resolve.alias)) {
        config.resolve.alias.push({
          find: 'react/compiler-runtime',
          replacement: reactCompilerRuntime,
        })
      } else {
        config.resolve.alias = {
          ...(config.resolve.alias as Record<string, string>),
          'react/compiler-runtime': reactCompilerRuntime,
        }
      }
    } catch (e) {
      console.warn('Failed to resolve react/compiler-runtime alias:', e)
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

    // Next/Image config is imported by Storybook preview/Vitest setup.
    // Pre-bundle it to avoid Vite discovering it mid-run (which triggers a reload).
    config.optimizeDeps.include = Array.from(
      new Set([...(config.optimizeDeps.include as string[]), 'next/dist/shared/lib/image-config']),
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
