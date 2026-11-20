import { expect, test } from '@playwright/test'

import { setCookieConsent } from '../helpers/cookieConsent'

for (const type of ['recovery', 'patient-verification']) {
  test(`${type} can switch language on the protected confirmation page @smoke`, async ({ page, context }) => {
    await setCookieConsent(context)
    await page.goto(`/auth/confirm?type=${type}&lang=en`, { waitUntil: 'domcontentloaded' })
    const main = page.getByRole('main')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    const english = main.getByRole('navigation').getByRole('link', { name: 'English', exact: true })
    await expect(english).toHaveAttribute('hreflang', 'en')
    await english.click()
    await expect(page).toHaveURL(`/auth/en/confirm?type=${type}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(main.getByRole('alert')).toBeVisible()
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex, nofollow/)

    const german = main.getByRole('navigation').getByRole('link', { name: 'Deutsch', exact: true })
    await expect(german).toHaveAttribute('hreflang', 'de')
    await german.click()
    await expect(page).toHaveURL(`/auth/confirm?type=${type}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })
}

test('the English confirmation alias only serves a single supported flow @smoke', async ({ page, request }) => {
  for (const search of ['', '?type=invite', '?type=recovery&type=patient-verification', '?type=unknown']) {
    const response = await request.get(`/auth/en/confirm${search}`)
    expect(response.status()).toBe(404)
  }

  await page.goto('/auth/confirm?type=invite', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('main').locator('a[hreflang]')).toHaveCount(0)
})
