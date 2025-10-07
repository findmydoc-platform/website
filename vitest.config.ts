import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Simplified timeout
    hookTimeout: 60000,
    exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
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
      thresholds: {
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
        autoUpdate: process.env.CI !== 'true', // env.CI is automatically set to true in Github Actions
      },
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
