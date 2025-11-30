import { defineConfig, defineProject } from 'vitest/config'
import path from 'path'
import integrationThresholdConfig from './.github/coverage/vitest.thresholds.integration.js'
import unitThresholdConfig from './.github/coverage/vitest.thresholds.unit.js'
import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
const dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))

// More info at: https://storybook.js.org/docs/next/writing-tests/integrations/vitest-addon
const coverageExclude = [
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
  'src/components/atoms/**/*.tsx',
  'src/blocks/**/Component.tsx',
  'src/heros/**/*.tsx',
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
]
type CoverageScope = 'unit' | 'integration'
type Thresholds = {
  statements: number
  branches: number
  functions: number
  lines: number
}
const coverageThresholds: Record<CoverageScope, Thresholds> = {
  unit: unitThresholdConfig.test.coverage.thresholds,
  integration: integrationThresholdConfig.test.coverage.thresholds,
}
const reportsDirectoryByScope: Record<CoverageScope, string> = {
  unit: 'coverage/unit',
  integration: 'coverage/integration',
}
const alias = {
  '@': path.resolve(__dirname, './src'),
  '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
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
  if (last === 'unit' || last === 'integration') return last
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
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: coverageExclude,
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
          include: ['tests/unit/**/*.test.ts'],
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
        },
      },
    ],
  },
})
