import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

test.beforeEach(async ({ context }) => {
  await setCookieConsent(context)
})

for (const { locale, path, submitLabel } of [
  { locale: 'de', path: '/register/patient', submitLabel: 'Bestätigungs-E-Mail anfordern' },
  { locale: 'en', path: '/en/register/patient', submitLabel: 'Request verification email' },
] as const) {
  test(`patient can correct and resend a verification request in ${locale} @smoke`, async ({ page }) => {
    const issues = createBrowserIssueCollector(page)
    await page.goto(`${path}#patient-verification-resend`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('html')).toHaveAttribute('lang', locale)

    const form = page.locator('form[action="/api/auth/register/patient/resend"]')
    const email = form.getByRole('textbox')
    const submit = form.getByRole('button', { name: submitLabel })
    await expect(submit).toBeVisible()
    await submit.click()
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(/\S/)

    await email.fill('not-an-address')
    await submit.click()
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(/\S/)

    let respond: () => void = () => {}
    const pending = new Promise<void>((resolve) => {
      respond = resolve
    })
    await page.route('**/api/auth/register/patient/resend', async (route) => {
      await pending
      await route.fulfill({ status: 202, json: { ok: true } })
    })
    const validEmail = 'patient@example.test'
    await email.fill(validEmail)
    await expect(email).not.toHaveAttribute('aria-invalid', 'true')

    const request = page.waitForRequest('**/api/auth/register/patient/resend')
    await submit.click()
    try {
      const resendRequest = await request
      expect(resendRequest.method()).toBe('POST')
      expect(resendRequest.postDataJSON()).toEqual({ email: validEmail })
      await expect(form.getByRole('button')).toBeDisabled()
      await expect(form.getByRole('status')).toContainText(/\S/)
    } finally {
      respond()
    }

    await expect(form.getByRole('status')).toBeVisible()
    await expect(email).toHaveValue('')
    await expect(submit).toBeEnabled()
    await expect(page).toHaveURL(`${path}#patient-verification-resend`)
    await expectNoBrowserIssues(issues)
  })
}

test('an invalid patient verification link leads to the German resend form @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  await page.goto('/auth/confirm?type=patient-verification', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'E-Mail-Adresse bestätigen' })).toHaveCount(0)

  await page.getByRole('link', { name: 'Bestätigungs-E-Mail anfordern' }).click()
  await expect(page).toHaveURL('/register/patient#patient-verification-resend')
  await expect(page.getByRole('button', { name: 'Bestätigungs-E-Mail anfordern' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expectNoBrowserIssues(issues)
})

test('legacy invite confirmation keeps the English document language @smoke', async ({ page }) => {
  await page.goto('/auth/confirm?type=invite', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
