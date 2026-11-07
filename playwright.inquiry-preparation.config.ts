import { defineConfig } from '@playwright/test'

export default defineConfig({
  testMatch: 'tests/e2e/public/inquiry-preparation.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/inquiry-preparation/artifacts',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
})
