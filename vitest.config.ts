import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    testTimeout: 120000, // Increased for database operations and PayloadCMS initialization
    include: [
      'src/**/__tests__/**/*.(js|jsx|ts|tsx)',
      'src/**/*.(test|spec).(js|jsx|ts|tsx)',
      'test/**/*.(test|spec).(js|jsx|ts|tsx)',
    ],
    exclude: ['.next/', 'node_modules/', '**/node_modules/**'],
    coverage: {
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/migrations/**', 'src/payload-types.ts'],
    },
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@payload-config': path.resolve(__dirname, 'src/payload.config.ts'),
    },
  },
})
