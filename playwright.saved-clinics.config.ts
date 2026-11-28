import { defineConfig } from '@playwright/test'

import { loadLocalAndTestEnv, resolvePlaywrightBaseURL } from './scripts/test-env.mjs'

loadLocalAndTestEnv()

export default defineConfig({
  testMatch: 'tests/e2e/public/saved-clinics.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/saved-clinics/artifacts',
  reporter: [['list']],
  use: {
    baseURL: resolvePlaywrightBaseURL(),
    actionTimeout: 15_000,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
