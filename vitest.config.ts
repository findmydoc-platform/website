import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 120000, // Increased for database operations and PayloadCMS initialization
    include: ['**/__tests__/**/*.(js|jsx|ts|tsx)', '**/*.(test|spec).(js|jsx|ts|tsx)'],
    exclude: ['.next/', 'node_modules/'],
    coverage: {
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/migrations/**', 'src/payload-types.ts'],
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': '/home/runner/work/website/website/src',
      '@payload-config': '/home/runner/work/website/website/src/payload.config.ts',
    },
  },
})