import { expect, test } from '@playwright/test'

import { AUTH_FLASH_STORAGE_KEY, createPasswordResetCompleteFlash } from '@/auth/utilities/authFlash'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const locales = [
  {
    locale: 'de',
    path: '/login/patient',
    email: 'E-Mail',
    password: 'Passwort',
    submit: 'Anmelden',
    pending: 'Anmeldung läuft …',
  },
  {
    locale: 'en',
    path: '/en/login/patient',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
    pending: 'Signing in...',
  },
] as const

test.beforeEach(async ({ context }) => {
  await setCookieConsent(context)
})

for (const copy of locales) {
  test(`patient login allows correction of invalid input in ${copy.locale} @smoke`, async ({ page }) => {
    const issues = createBrowserIssueCollector(page)
    await page.goto(copy.path)
    const email = page.getByLabel(copy.email, { exact: true })
    const password = page.getByLabel(copy.password, { exact: true })
    const submit = page.getByRole('button', { name: copy.submit, exact: true })

    await email.fill('not-an-email')
    await submit.click()
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(password).toHaveAttribute('aria-invalid', 'true')
    for (const field of [email, password]) {
      const error = await field.getAttribute('aria-describedby')
      await expect(page.getByRole('alert').and(page.locator(`[id="${error}"]`))).toBeVisible()
    }

    await email.fill('patient@example.com')
    await expect(email).not.toHaveAttribute('aria-invalid')
    await expectNoBrowserIssues(issues)
  })
}

for (const copy of locales) {
  test(`patient login reports failure and retries successfully in ${copy.locale} @smoke`, async ({
    page,
  }, testInfo) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [/Failed to load resource: the server responded with a status of 401 .*\/api\/auth\/login/],
    })
    const providerDetail = 'Unexpected provider detail for the browser test'
    const nextPath = '/privacy-policy?from=patient-login'
    const submissions: unknown[] = []
    let finishFailure = () => {}
    const failureCanFinish = new Promise<void>((resolve) => {
      finishFailure = resolve
    })
    await page.route('**/api/auth/login', async (route) => {
      submissions.push(route.request().postDataJSON())
      if (submissions.length === 1) {
        await failureCanFinish
        await route.fulfill({ status: 401, json: { error: 'Invalid login credentials', message: providerDetail } })
      } else {
        await route.fulfill({
          json: {
            success: true,
            redirectUrl: '/patient/inquiries',
            user: { id: 'patient-1', email: 'patient@example.com', userType: 'patient' },
          },
        })
      }
    })

    const loginUrl = `${copy.path}?next=${encodeURIComponent(nextPath)}`
    await page.setViewportSize({ width: 375, height: 500 })
    await page.goto(loginUrl)
    const email = page.getByLabel(copy.email, { exact: true })
    const password = page.getByLabel(copy.password, { exact: true })
    const submit = page.getByRole('button', { name: copy.submit, exact: true })
    const firstPassword = 'RejectedFixturePassword' // pragma: allowlist secret
    const secondPassword = 'AcceptedFixturePassword' // pragma: allowlist secret

    await email.fill('patient@example.com')
    await password.fill(firstPassword)
    try {
      await submit.click()
      await expect(page.getByRole('button', { name: copy.pending, exact: true })).toBeDisabled()
      await expect(email).toBeDisabled()
      await expect(password).toBeDisabled()
      await page.screenshot({ path: testInfo.outputPath(`patient-login-${copy.locale}-pending-375x500.png`) })
    } finally {
      finishFailure()
    }

    const error = page.getByRole('main').getByRole('alert')
    await expect(error).toBeVisible()
    await expect(error).not.toContainText(providerDetail)
    await page.screenshot({ path: testInfo.outputPath(`patient-login-${copy.locale}-failure-375x500.png`) })
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === loginUrl)
    await expect(submit).toBeEnabled()
    await expect(email).toHaveValue('patient@example.com')
    await password.fill(secondPassword)
    await submit.click()
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === nextPath, { timeout: 20_000 })
    expect(submissions).toEqual([
      { email: 'patient@example.com', password: firstPassword, allowedUserTypes: ['patient'] },
      { email: 'patient@example.com', password: secondPassword, allowedUserTypes: ['patient'] },
    ])
    await expectNoBrowserIssues(issues)
  })
}

test('patient login announces registration and password reset in the requested language @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const registrationFeedback: string[] = []
  const recoveryFeedback: string[] = []
  const feedback = page.getByRole('main').getByRole('status')

  for (const copy of locales) {
    await page.goto(`${copy.path}?message=patient-check-email`)
    await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
    await expect(feedback).toBeVisible()
    registrationFeedback.push(await feedback.innerText())

    const recoveryFlash = await page.addInitScript(
      ({ path, key, flash }) => {
        if (window === window.top && location.pathname === path && !location.search) {
          sessionStorage.setItem(key, JSON.stringify(flash))
        }
      },
      { path: copy.path, key: AUTH_FLASH_STORAGE_KEY, flash: createPasswordResetCompleteFlash() },
    )
    try {
      await page.goto(copy.path)
    } finally {
      await recoveryFlash.dispose()
    }

    await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
    await expect(feedback).toBeVisible()
    recoveryFeedback.push(await feedback.innerText())
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_FLASH_STORAGE_KEY)).toBeNull()
    await page.reload()
    await expect(feedback).toHaveCount(0)
  }

  expect(new Set(registrationFeedback).size).toBe(locales.length)
  expect(new Set(recoveryFeedback).size).toBe(locales.length)
  await expectNoBrowserIssues(issues)
})
