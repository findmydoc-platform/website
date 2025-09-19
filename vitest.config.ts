import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 30000, // Simplified timeout
    exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
    coverage: {
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/migrations/**',
        'src/payload-types.ts',
        'src/payload.config.ts',
        'src/app/(payload)/**',
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
          setupFiles: ['tests/setup/supabaseProvisionMock.ts'],
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
