import { defineConfig, defineProject } from 'vitest/config'
import path from 'path'

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
  'src/components/ui/**/*.tsx',
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

type CoverageScope = 'unit' | 'integration' | 'all'

type Thresholds = {
  statements: number
  branches: number
  functions: number
  lines: number
}

const coverageThresholds: Record<CoverageScope, Thresholds> = {
  unit: {
    statements: 50,
    branches: 75,
    functions: 55,
    lines: 50,
  },
  integration: {
    statements: 40,
    branches: 55,
    functions: 35,
    lines: 40,
  },
  all: {
    statements: 45,
    branches: 65,
    functions: 45,
    lines: 45,
  },
}

const reportsDirectoryByScope: Record<CoverageScope, string> = {
  unit: 'coverage/unit',
  integration: 'coverage/integration',
  all: 'coverage/all',
}

const alias = {
  '@': path.resolve(__dirname, './src'),
  '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
} as const

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

const envScope = process.env.VITEST_COVERAGE_SCOPE as CoverageScope | undefined
const argScope = deriveScopeFromArgs()
const requestedScope = envScope ?? argScope ?? 'all'
const availableScopes: CoverageScope[] = ['unit', 'integration', 'all']
const resolvedScope = (
  availableScopes.includes(requestedScope as CoverageScope) ? requestedScope : 'all'
) as CoverageScope
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
          setupFiles: ['tests/setup/nextCacheMock.ts', 'tests/setup/supabaseProvisionMock.ts'],
          sequence: { concurrent: false },
          pool: 'threads',
          poolOptions: { threads: { singleThread: true } },
          hookTimeout: 60000,
          globals: true,
        },
      }),
    ],
  },
})
