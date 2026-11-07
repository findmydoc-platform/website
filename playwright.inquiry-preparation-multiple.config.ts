import { defineConfig } from '@playwright/test'
import { resolvePlaywrightBaseURL } from './scripts/test-env.mjs'

export default defineConfig({
  testMatch: 'tests/e2e/public/inquiry-preparation-multiple.spec.ts',
  workers: 1,
  timeout: 240_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/inquiry-preparation-multiple/artifacts',
  reporter: [['list']],
  use: { baseURL: resolvePlaywrightBaseURL(), screenshot: 'only-on-failure', trace: 'retain-on-failure' },
})
