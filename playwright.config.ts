import path from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { applyE2ERuntimeDefaults, loadLocalAndTestEnv, resolvePlaywrightBaseURL } from './scripts/test-env.mjs'
import { E2E_ADMIN_SESSION_FILE, E2E_OUTPUT_DIR, E2E_REPORT_DIR } from './tests/e2e/helpers/paths'

loadLocalAndTestEnv()
applyE2ERuntimeDefaults(process.env)

const baseURL = resolvePlaywrightBaseURL(process.env)
const useExternalBaseUrl = Boolean(process.env.PLAYWRIGHT_BASE_URL)

export default defineConfig({
  testDir: path.join(process.cwd(), 'tests/e2e'),
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  outputDir: path.join(E2E_OUTPUT_DIR, 'artifacts'),
  reporter: [['list'], ['html', { open: 'never', outputFolder: E2E_REPORT_DIR }]],
  retries: process.env.CI ? 1 : 0,
  timeout: process.env.CI ? 90_000 : 60_000,
  use: {
    baseURL,
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
  },
  workers: 1,
  projects: [
    {
      name: 'setup-admin',
      testMatch: /tests\/e2e\/setup\/admin\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'admin-auth',
      dependencies: ['setup-admin'],
      testMatch: /tests\/e2e\/admin\/auth\.admin-login\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'admin-smoke',
      dependencies: ['setup-admin'],
      testMatch: /tests\/e2e\/admin\/.*\.admin-smoke\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: E2E_ADMIN_SESSION_FILE,
      },
    },
  ],
  webServer: useExternalBaseUrl
    ? undefined
    : {
        command: 'node scripts/e2e-server.mjs',
        reuseExistingServer: false,
        url: baseURL,
        timeout: 180_000,
      },
})
