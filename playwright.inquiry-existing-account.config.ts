import { defineConfig } from '@playwright/test'

export default defineConfig({
  testMatch: 'tests/e2e/public/inquiry-preparation-existing-account.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/inquiry-existing-account/artifacts',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:3000', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
})
