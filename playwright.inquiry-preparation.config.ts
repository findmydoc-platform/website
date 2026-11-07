import { defineConfig } from '@playwright/test'
import { resolvePlaywrightBaseURL } from './scripts/test-env.mjs'

export default defineConfig({
  testMatch: 'tests/e2e/public/inquiry-preparation.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/inquiry-preparation/artifacts',
  reporter: [['list']],
  use: {
    baseURL: resolvePlaywrightBaseURL({ E2E_PORT: '3000', ...process.env }),
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
