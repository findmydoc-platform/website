import { expect, test } from '@playwright/test'

import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'

const origin = resolvePlaywrightBaseURL(process.env)
if (new URL(origin).hostname !== 'localhost') throw new Error('The patient session browser test requires localhost.')

const artifacts = 'output/playwright/patient-auth'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 0, templateKind: 'empty' })
const patientEmail = 'session-patient@example.test'
const patientPassword = 'SyntheticPatient123' // pragma: allowlist secret
const accountButton = /open account menu|kontomenü öffnen/i
const signOut = /sign out|abmelden/i
const signIn = /patient login|anmelden/i

const cases = [
  { locale: 'de', base: '', oppositeBase: '/en', emailLabel: 'E-Mail', passwordLabel: 'Passwort', submit: 'Anmelden' }, // pragma: allowlist secret
  { locale: 'en', base: '/en', oppositeBase: '', emailLabel: 'Email', passwordLabel: 'Password', submit: 'Sign in' }, // pragma: allowlist secret
] as const

test('patients can correct sign-in failures, continue, and sign out in both languages', async ({
  browser,
}, testInfo) => {
  const feedback = { validation: new Set<string>(), credentials: new Set<string>(), signOut: new Set<string>() }

  for (const copy of cases) {
    runtime.existingUser(patientEmail)
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 500 } })
    try {
      const page = await context.newPage()
      await setCookieConsent(context)
      const issues = createBrowserIssueCollector(page, {
        ignoredConsoleErrors: [
          /Failed to load resource: the server responded with a status of 401 .*\/api\/auth\/login/,
        ],
      })
      const query = '?from=sign-in#results'
      const loginPath = `${copy.base}/login/patient`
      const next = `${copy.oppositeBase}/listing-comparison${query}`
      await page.goto(`${loginPath}?next=${encodeURIComponent(next)}`)
      await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)

      const email = page.getByLabel(copy.emailLabel, { exact: true })
      const password = page.getByLabel(copy.passwordLabel, { exact: true })
      const submit = page.getByRole('button', { name: copy.submit, exact: true })
      const main = page.getByRole('main')
      await email.fill('invalid-email')
      await submit.click()
      await expect(email).toBeFocused()
      await expect(email).toHaveAttribute('aria-invalid', 'true')
      const validation = page.locator(`[id="${await email.getAttribute('aria-describedby')}"]`)
      await expect(validation).toBeVisible()
      feedback.validation.add(await validation.innerText())

      await email.fill(patientEmail)
      await password.fill('IncorrectFixturePassword') // pragma: allowlist secret
      const denied = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
      await submit.click()
      expect((await denied).status()).toBe(401)
      const error = main.getByRole('alert')
      await expect(error).toBeVisible()
      feedback.credentials.add(await error.innerText())

      for (const width of [320, 375, 640, 768, 1024]) {
        await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.screenshot({
          path: testInfo.outputPath(`${copy.locale}-sign-in-error-${width}.png`),
          fullPage: true,
        })
      }
      await page.setViewportSize({ width: 375, height: 500 })
      await password.fill(patientPassword)
      await submit.click()
      const destination = `${copy.base}/listing-comparison${query}`
      await expect(page).toHaveURL(destination)
      await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)

      const menu = page.getByRole('banner').getByRole('button', { name: accountButton })
      await menu.click()
      const logout = page.getByRole('menuitem', { name: signOut })
      await expect(logout).toHaveAttribute('href', `${copy.base}/logout`)

      let releaseLogout = () => {}
      const statusCanFinish = new Promise<void>((resolve) => {
        releaseLogout = resolve
      })
      await page.route('**/auth/v1/logout?*', async (route) => {
        await statusCanFinish
        await route.continue()
      })
      try {
        await logout.click()
        await expect(page).toHaveURL(`${copy.base}/logout`)
        const status = main.getByRole('status')
        await expect(status).toBeVisible()
        await expect(status).toContainText(/\S/)
        await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
        feedback.signOut.add(await status.innerText())
        await page.screenshot({ path: testInfo.outputPath(`${copy.locale}-sign-out-status-375x500.png`) })
      } finally {
        releaseLogout()
      }

      await expect(page).toHaveURL(loginPath)
      await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
      await expect(submit).toBeVisible()
      await menu.click()
      await expect(page.getByRole('menuitem', { name: signIn })).toHaveAttribute('href', loginPath)
      await page.screenshot({ path: testInfo.outputPath(`${copy.locale}-signed-out-375x500.png`) })
      await expectNoBrowserIssues(issues)
    } finally {
      await context.close()
    }
  }

  for (const translatedStates of Object.values(feedback)) expect(translatedStates.size).toBe(cases.length)
  expect(runtime.providerRequests.filter((request) => request === 'POST /auth/v1/logout')).toHaveLength(cases.length)
})
