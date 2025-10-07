import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Simplified timeout
    hookTimeout: 60000,
    exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
    // Coverage metrics explained:
    // - Statements: % of executable statements that were executed
    // - Branches: % of decision branches (if/else, switch cases, etc.) that were taken
    // - Functions: % of declared functions that were called
    // - Lines: % of code lines that were executed (similar to statements but counts physical lines)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
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
      ],
      reportOnFailure: true,
      reporter: ['text', 'html', 'json-summary', 'json'],
    },
    globals: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node',
          setupFiles: [
            'tests/setup/supabaseProvisionMock.ts',
            'tests/setup/permissionMatrixUnitSetup.ts',
          ],
          coverage: {
            thresholds: {
              statements: 50,
              branches: 75,
              functions: 55,
              lines: 50,
              autoUpdate: process.env.CI !== 'true', // env.CI is automatically set to true in GitHub Actions
            },
          },
        },
      },
      {
        extends: true,
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
          coverage: {
            thresholds: {
              statements: 40,
              branches: 55,
              functions: 35,
              lines: 40,
              autoUpdate: process.env.CI !== 'true', // env.CI is automatically set to true in GitHub Actions
            },
          },
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@payload-config': path.resolve(__dirname, './src/payload.config.ts'),
    },
  },
})
