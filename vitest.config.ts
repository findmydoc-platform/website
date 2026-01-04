import { defineConfig, defineProject } from 'vitest/config'
import path from 'path'
import integrationThresholdConfig from './.github/coverage/vitest.thresholds.integration.js'
import unitThresholdConfig from './.github/coverage/vitest.thresholds.unit.js'
import storybookThresholdConfig from './.github/coverage/vitest.thresholds.storybook.js'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const baseExclude = [
  'src/**/*.d.ts',
  'src/migrations/**',
  'src/payload-types.ts',
  'src/payload.config.ts',
  'src/app/(payload)/**',
  'src/cssVariables.js',
  'src/instrumentation*.ts',
  'src/posthog/**/*.ts',
  'src/blocks/Form/**/*options.ts',
  'src/endpoints/seed/**/*.ts',
  'src/app/(frontend)/(pages|sitemaps)/**/*.{ts,tsx}',
  'src/app/(frontend)/**/page.client.tsx',
  'src/app/(frontend)/**/layout.tsx',
  'src/app/(payload)/layout.tsx',
  'src/app/(payload)/admin/[[...segments]]/page.tsx',
  'src/app/(payload)/admin/[[...segments]]/not-found.tsx',
  'src/app/(payload)/api/[...slug]/route.ts',
  'src/app/(payload)/api/graphql/route.ts',
  'src/app/(payload)/api/graphql-playground/route.ts',
  'src/app/api/basicUsers/route.ts',
  'src/stories/**',
]

const unitExclude = [
  ...baseExclude,
  'src/components/atoms/**/*.tsx',
  'src/components/molecules/**/*.tsx',
  'src/components/organisms/**/*.tsx',
  'src/components/templates/**/*.tsx',
  'src/blocks/**/Component.tsx',
]

const storybookExclude = [...baseExclude, 'src/collections/**', 'src/utilities/**', 'src/blocks/**', 'src/access/**']

type CoverageScope = 'unit' | 'integration' | 'storybook'
type Thresholds = {
  statements: number
  branches: number
  functions: number
  lines: number
}
const coverageThresholds: Record<CoverageScope, Thresholds> = {
  unit: unitThresholdConfig.test.coverage.thresholds,
  integration: integrationThresholdConfig.test.coverage.thresholds,
  storybook: storybookThresholdConfig.test.coverage.thresholds,
}
const reportsDirectoryByScope: Record<CoverageScope, string> = {
  unit: 'coverage/unit',
  integration: 'coverage/integration',
  storybook: 'coverage/storybook',
}
const excludeByScope: Record<CoverageScope, string[]> = {
  unit: unitExclude,
  integration: unitExclude,
  storybook: storybookExclude,
}
const includeByScope: Record<CoverageScope, string[]> = {
  unit: ['src/**/*.{js,jsx,ts,tsx}'],
  integration: ['src/**/*.{js,jsx,ts,tsx}'],
  storybook: ['src/components/**/*.{js,jsx,ts,tsx}'],
}
const alias = {
  '@': path.resolve(__dirname, './src'),
  '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
  // Explicit aliases for atomic design components to ensure correct resolution in tests
  '@/components/atoms': path.resolve(__dirname, './src/components/atoms'),
  '@/components/molecules': path.resolve(__dirname, './src/components/molecules'),
  '@/components/organisms': path.resolve(__dirname, './src/components/organisms'),
  '@/components/templates': path.resolve(__dirname, './src/components/templates'),
  '@/components/pages': path.resolve(__dirname, './src/components/pages'),
} as const

/**
 * Returns the last --project flag value when it aligns with a known coverage scope.
 */
const deriveScopeFromArgs = (): CoverageScope | undefined => {
  if (process.env.npm_lifecycle_event === 'storybook') return 'storybook'

  const flagValues = process.argv.reduce<string[]>((acc, arg, index, argv) => {
    if (arg === '--project') {
      const value = argv[index + 1]
      if (value) acc.push(value)
      return acc
    }
    const inlineMatch = arg.match(/^--project=(.+)$/)
    if (inlineMatch) {
      const [, value] = inlineMatch
      if (value) acc.push(value)
    }
    return acc
  }, [])
  const last = flagValues.at(-1)
  if (!last || last.startsWith('!')) return undefined
  if (last === 'unit' || last === 'integration' || last === 'storybook') return last as CoverageScope
  return undefined
}
const argScope = deriveScopeFromArgs()
const resolvedScope: CoverageScope = argScope ?? 'unit'
const selectedThresholds = coverageThresholds[resolvedScope]
const coverageThresholdConfig = {
  ...selectedThresholds,
}
export default defineConfig({
  resolve: {
    alias,
  },
  test: {
    coverage: {
      provider: 'v8',
      include: includeByScope[resolvedScope],
      exclude: excludeByScope[resolvedScope],
      reportOnFailure: true,
      reporter: ['text', 'html', 'json-summary', 'json'],
      reportsDirectory: reportsDirectoryByScope[resolvedScope],
      thresholds: coverageThresholdConfig,
    },
    projects: [
      defineProject({
        resolve: {
          alias,
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts', 'tests/unit/**/*.test.tsx'],
          environment: 'node',
          testTimeout: 30000,
          hookTimeout: 60000,
          exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
          globals: true,
          setupFiles: [
            'tests/setup/silenceLogs.ts',
            'tests/setup/nextCacheMock.ts',
            'tests/setup/supabaseProvisionMock.ts',
            'tests/setup/permissionMatrixUnitSetup.ts',
          ],
        },
      }),
      defineProject({
        resolve: {
          alias,
        },
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          environment: 'node',
          globalSetup: './tests/setup/integrationGlobalSetup.ts',
          setupFiles: [
            'tests/setup/silenceLogs.ts',
            'tests/setup/nextCacheMock.ts',
            'tests/setup/supabaseProvisionMock.ts',
          ],
          sequence: {
            concurrent: false,
          },
          pool: 'threads',
          fileParallelism: false,
          hookTimeout: 60000,
          globals: true,
        },
      }),
      {
        extends: true,
        plugins: [
          // The plugin will run tests for the stories defined in your Storybook config
          // See options at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon#storybooktest
          storybookTest({
            configDir: path.join(dirname, '.storybook'),
          }),
        ],
        test: {
          name: 'storybook',
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              {
                browser: 'chromium',
              },
            ],
          },
          setupFiles: ['.storybook/vitest.setup.ts'],
          // Optimize dependencies to avoid "Failed to fetch dynamically imported module" errors
          // particularly with React 19 and Storybook in CI environments
          deps: {
            optimizer: {
              web: {
                include: [
                  'react',
                  'react-dom',
                  'react-dom/client',
                  'react/jsx-runtime',
                  'react/jsx-dev-runtime',
                  '@storybook/react',
                  '@payloadcms/ui',
                  '@storybook/addon-a11y',
                  'axe-core',
                ],
              },
            },
          },
        },
      },
    ],
  },
})
