import { defineConfig, devices } from '@playwright/test'
import { resolvePlaywrightBaseURL } from './scripts/test-env.mjs'

export default defineConfig({
  testMatch: 'tests/e2e/public/auth.patient-session.spec.ts',
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 30_000 },
  outputDir: 'output/playwright/patient-auth/artifacts',
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: resolvePlaywrightBaseURL(process.env),
    screenshot: 'only-on-failure',
  },
})
