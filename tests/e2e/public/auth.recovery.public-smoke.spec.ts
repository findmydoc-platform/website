import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'
import { expectRobotsIndexingBlocked } from '../helpers/robots'

const recoveryRoute = '/auth/password/reset'
const email = 'recovery-browser@example.test'
const providerDetail = 'synthetic-private-provider-detail'
const viewports = [320, 375, 640, 768, 1024]

for (const { locale, prefix, emailLabel } of [
  {
    locale: 'de',
    prefix: '',
    emailLabel: 'E-Mail-Adresse',
  },
  {
    locale: 'en',
    prefix: '/en',
    emailLabel: 'Email',
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
    const canonical = new URL(`${prefix}${recoveryRoute}`, baseURL).href
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical)
    await expectRobotsIndexingBlocked(page)
    const form = page.locator(`form[action="${resetEndpoint}"]`)
    const emailField = form.getByRole('textbox', { name: emailLabel })
    const submit = form.locator('button[type="submit"]')
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
      await expect(submit).toBeDisabled()
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
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeFocused()
    await expect(emailField).toBeDisabled()
    await expect(submit).toBeDisabled()
    await expect(emailField).toHaveValue('')
    expect(requests).toEqual([
      { email, locale },
      { email, locale },
    ])

    for (const width of viewports) {
      await page.setViewportSize({ width, height: 800 })
      await expect(form.getByRole('status')).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: test.info().outputPath(`recovery-${locale}-${width}.png`), fullPage: true })
    }
    await page.setViewportSize({ width: 375, height: 400 })
    await page.getByRole('main').getByRole('navigation').getByRole('link').first().click()
    await expect(page).toHaveURL(new URL(`${prefix}/login/patient`, baseURL).href)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
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
  baseURL,
}) => {
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page)
  const protectedScreens = [
    {
      name: 'confirmation-de',
      path: '/auth/callback?type=recovery&locale=de',
      locale: 'de',
      canonicalPath: '/auth/confirm',
      requestPath: recoveryRoute,
    },
    {
      name: 'confirmation-en',
      path: '/auth/callback?type=recovery&locale=en',
      locale: 'en',
      canonicalPath: '/auth/en/confirm',
      requestPath: `/en${recoveryRoute}`,
    },
    {
      name: 'completion-de',
      path: '/auth/password/reset/complete',
      locale: 'de',
      canonicalPath: '/auth/password/reset/complete',
      requestPath: recoveryRoute,
    },
    {
      name: 'completion-en',
      path: '/auth/en/password/reset/complete',
      locale: 'en',
      canonicalPath: '/auth/en/password/reset/complete',
      requestPath: `/en${recoveryRoute}`,
    },
  ]
  const main = page.getByRole('main')
  const alert = main.getByRole('alert')

  for (const { name, path, locale, canonicalPath, requestPath } of protectedScreens) {
    const url = `${path}${path.includes('?') ? '&' : '?'}error=${providerDetail}`
    const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBe(true)
    await expect(alert).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    const canonical = new URL(canonicalPath, baseURL)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical.href)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical.href)
    await expectRobotsIndexingBlocked(page)
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

  await main.locator(`a[href="/en${recoveryRoute}"]`).click()
  await expect(page).toHaveURL(/\/en\/auth\/password\/reset$/)
  await expectNoBrowserIssues(issues)
})

test('the public recovery request keeps its draft and expired-link context across languages @smoke', async ({
  page,
  context,
}, testInfo) => {
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page)
  const main = page.getByRole('main')
  const form = main.locator('form[action="/api/auth/password/reset"]')
  const emailField = form.getByRole('textbox')
  const germanLanguage = page.getByRole('banner').getByRole('button', { name: /Sprache/ })
  const englishLanguage = page.getByRole('banner').getByRole('button', { name: /Language/ })
  const incompleteEmail = 'recovery.incomplete@'
  const path = `${recoveryRoute}?reason=expired`

  await page.setViewportSize({ width: 375, height: 400 })
  await page.goto(`${path}&lang=en`)
  await expect(form.getByRole('status')).toBeVisible()
  await emailField.fill(incompleteEmail)

  await germanLanguage.click()
  const english = page.getByRole('link', { name: 'English', exact: true })
  await expect(english).toBeVisible()
  await english.click()
  await expect(page).toHaveURL(`/en${path}`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(emailField).toHaveValue(incompleteEmail)
  await expect(form.getByRole('status')).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('recovery-language-switch-preserved-375x400.png') })

  await englishLanguage.click()
  await page.getByRole('link', { name: 'Deutsch', exact: true }).click()
  await expect(page).toHaveURL(path)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(emailField).toHaveValue(incompleteEmail)
  await expectNoBrowserIssues(issues)
})
