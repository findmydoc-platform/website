import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const recoveryRoute = '/auth/password/reset'
const email = 'recovery-browser@example.test'
const providerDetail = 'synthetic-private-provider-detail'
const viewports = [320, 375, 640, 768, 1024]

for (const { locale, prefix, emailLabel, submitLabel, pendingLabel } of [
  {
    locale: 'de',
    prefix: '',
    emailLabel: 'E-Mail-Adresse',
    submitLabel: 'Anleitung zum Zurücksetzen senden',
    pendingLabel: 'E-Mail zum Zurücksetzen wird gesendet...',
  },
  {
    locale: 'en',
    prefix: '/en',
    emailLabel: 'Email',
    submitLabel: 'Send reset instructions',
    pendingLabel: 'Sending reset email...',
  },
]) {
  test(`password recovery requests validate and retry in ${locale} @smoke`, async ({ page, context, baseURL }) => {
    await setCookieConsent(context)
    const resetEndpoint = '/api/auth/password/reset'
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [/Failed to load resource.*503.*\/api\/auth\/password\/reset/],
    })
    const requests: unknown[] = []
    let releaseFirstRequest = () => {}
    const firstRequest = new Promise<void>((resolve) => {
      releaseFirstRequest = resolve
    })
    await page.route(resetEndpoint, async (route) => {
      expect(route.request().method()).toBe('POST')
      requests.push(route.request().postDataJSON())
      if (requests.length === 1) {
        await firstRequest
        await route.fulfill({ status: 503, json: { error: providerDetail } })
      } else {
        await route.fulfill({ json: { success: true } })
      }
    })

    const destination = `${prefix}${recoveryRoute}?reason=unrecognized&lang=${locale === 'de' ? 'en' : 'de'}`
    const response = await page.goto(destination, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBe(true)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    const form = page.locator(`form[action="${resetEndpoint}"]`)
    const emailField = form.getByRole('textbox', { name: emailLabel })
    const submit = form.getByRole('button', { name: submitLabel })
    await expect(form.getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('main').getByRole('navigation').getByRole('link').first()).toHaveAttribute(
      'href',
      `${prefix}/login/patient`,
    )
    await page.setViewportSize({ width: 375, height: 400 })
    await submit.click()
    await expect(emailField).toBeFocused()
    await expect(emailField).toHaveAttribute('aria-invalid', 'true')
    await expect(emailField).toHaveAccessibleDescription(/\S/)
    expect(requests).toEqual([])

    await emailField.fill(email)
    await submit.click()
    try {
      await expect(form.getByRole('button', { name: pendingLabel })).toBeDisabled()
    } finally {
      releaseFirstRequest()
    }
    await expect(form.getByRole('alert')).toBeVisible()
    await expect(form.getByText(providerDetail)).toHaveCount(0)
    await expect(page).toHaveURL(new URL(destination, baseURL).href)
    await expect(emailField).toHaveValue(email)
    await page.screenshot({ path: test.info().outputPath(`recovery-${locale}-short-height.png`), fullPage: true })
    await submit.click()
    await expect(form.getByRole('status')).toBeVisible()
    await expect(emailField).toHaveValue('')
    expect(requests).toEqual([{ email }, { email }])

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 800 })
      await expect(form.getByRole('status')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: test.info().outputPath(`recovery-${locale}-${width}.png`), fullPage: true })
    }
    await page.goto(`${prefix}${recoveryRoute}?reason=expired`, { waitUntil: 'domcontentloaded' })
    await expect(form.getByRole('status')).toBeVisible()
    await expect(emailField).toHaveValue('')
    await expect(submit).toBeEnabled()
    await expectNoBrowserIssues(issues)
  })
}

test('protected recovery screens keep an invalid link safe and offer a new request @smoke', async ({
  page,
  context,
}) => {
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page)
  const protectedScreens = [
    { name: 'confirmation-de', path: '/auth/confirm?type=recovery', locale: 'de', requestPath: recoveryRoute },
    {
      name: 'confirmation-en',
      path: '/auth/en/confirm?type=recovery',
      locale: 'en',
      requestPath: `/en${recoveryRoute}`,
    },
    { name: 'completion-de', path: '/auth/password/reset/complete', locale: 'de', requestPath: recoveryRoute },
    {
      name: 'completion-en',
      path: '/auth/en/password/reset/complete',
      locale: 'en',
      requestPath: `/en${recoveryRoute}`,
    },
  ]
  const main = page.getByRole('main')
  const alert = main.getByRole('alert')

  for (const { name, path, locale, requestPath } of protectedScreens) {
    const url = `${path}${path.includes('?') ? '&' : '?'}error=${providerDetail}`
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBe(true)
    await expect(alert).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex, nofollow/)
    await expect(main.getByText(providerDetail)).toHaveCount(0)
    await expect(main.locator('input[type="password"]')).toHaveCount(0)
    const requestLink = main.getByRole('link').and(main.locator(`[href="${requestPath}"]`))
    await expect(requestLink).toBeVisible()
    for (const width of viewports) {
      await page.setViewportSize({ width, height: 800 })
      await expect(alert).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: test.info().outputPath(`recovery-${name}-${width}.png`), fullPage: true })
    }
  }

  await main.getByRole('link', { name: 'Request a recovery email' }).click()
  await expect(page).toHaveURL(/\/en\/auth\/password\/reset$/)
  await expectNoBrowserIssues(issues)
})
