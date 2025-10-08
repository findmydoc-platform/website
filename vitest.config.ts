import { defineWorkspace } from 'vitest/config'
import path from 'path'

const shared = {
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
    },
  },
}

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

// Coverage metrics explained:
// - Statements: % of executable statements that were executed
// - Branches: % of decision branches (if/else, switch cases, etc.) that were taken
// - Functions: % of declared functions that were called
// - Lines: % of code lines that were executed (similar to statements but counts physical lines)

export default defineWorkspace([
  {
    ...shared,
    test: {
      name: 'unit',
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30000,
      hookTimeout: 60000,
      exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
      globals: true,
      setupFiles: [
        'tests/setup/supabaseProvisionMock.ts',
        'tests/setup/permissionMatrixUnitSetup.ts',
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,jsx,ts,tsx}'],
        exclude: coverageExclude,
        reportOnFailure: true,
        reporter: ['text', 'html', 'json-summary', 'json'],
        reportsDirectory: 'coverage/unit',
        thresholds: {
          statements: 50,
          branches: 75,
          functions: 55,
          lines: 50,
          autoUpdate: process.env.CI !== 'true',
        },
      },
    },
  },
  {
    ...shared,
    test: {
      name: 'integration',
      include: ['tests/integration/**/*.test.ts'],
      environment: 'node',
      globalSetup: './tests/setup/integrationGlobalSetup.ts',
      setupFiles: ['tests/setup/supabaseProvisionMock.ts'],
      sequence: { concurrent: false },
      pool: 'threads',
      poolOptions: { threads: { singleThread: true } },
      hookTimeout: 60000,
      globals: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{js,jsx,ts,tsx}'],
        exclude: coverageExclude,
        reportOnFailure: true,
        reporter: ['text', 'html', 'json-summary', 'json'],
        reportsDirectory: 'coverage/integration',
        thresholds: {
          statements: 40,
          branches: 55,
          functions: 35,
          lines: 40,
          autoUpdate: process.env.CI !== 'true',
        },
      },
    },
  },
])
