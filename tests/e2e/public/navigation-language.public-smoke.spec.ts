import { execFileSync } from 'node:child_process'
import { expect, test } from '@playwright/test'

import { navigationLanguageScenario } from '../../fixtures/navigationLanguageScenario'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const languages = [
  {
    locale: 'de',
    prefix: '',
    mainNav: 'Hauptnavigation',
    mobileNav: 'Mobile Navigation',
    mobileOpener: 'Menü öffnen',
    accountOpener: 'Anmelden, Kontomenü öffnen',
    accountSignIn: 'Anmelden als Patient',
    comparison: 'Kliniken vergleichen',
    languageOpener: /Sprache/,
    otherLanguage: 'English',
    otherPrefix: '/en',
  },
  {
    locale: 'en',
    prefix: '/en',
    mainNav: 'Main navigation',
    mobileNav: 'Mobile navigation',
    mobileOpener: 'Open menu',
    accountOpener: 'Sign in, open account menu',
    accountSignIn: 'Patient login',
    comparison: 'Compare clinics',
    languageOpener: /Language/,
    otherLanguage: 'Deutsch',
    otherPrefix: '',
  },
] as const

for (const copy of languages) {
  test(`keeps shared navigation in ${copy.locale} across mobile and desktop @smoke`, async ({
    context,
    page,
  }, info) => {
    const browserIssues = createBrowserIssueCollector(page)
    await setCookieConsent(context)
    await page.setViewportSize({ width: 320, height: 400 })
    const loginPath = `${copy.prefix}/login/patient`
    await page.goto(loginPath)

    const header = page.getByRole('banner')
    const menuButton = header.getByRole('button', { name: copy.mobileOpener, exact: true })
    const comparisonPath = `${copy.prefix}/listing-comparison`
    await menuButton.focus()
    await page.keyboard.press('Enter')
    const mobileNav = header.getByRole('navigation', { name: copy.mobileNav })
    await expect(mobileNav.getByRole('link', { name: copy.comparison })).toHaveAttribute('href', comparisonPath)
    await page.screenshot({ path: info.outputPath(`mobile-menu-${copy.locale}-320x400.png`) })
    await page.keyboard.press('Escape')
    await expect(menuButton).toBeFocused()
    await expect(mobileNav).toHaveCount(0)

    const account = header.getByRole('button', { name: copy.accountOpener })
    await account.focus()
    await page.keyboard.press('Enter')
    const menu = page.getByRole('menu')
    await expect(menu).toHaveAttribute('lang', copy.locale)
    await expect(menu.getByRole('menuitem', { name: copy.accountSignIn })).toHaveAttribute('href', loginPath)
    await page.screenshot({ path: info.outputPath(`account-menu-${copy.locale}-320x400.png`) })
    await page.keyboard.press('Escape')
    await expect(account).toBeFocused()

    const language = header.getByRole('button', { name: copy.languageOpener })
    await language.focus()
    await page.keyboard.press('Enter')
    const equivalent = page.getByRole('link', { name: copy.otherLanguage, exact: true })
    await expect(equivalent).toBeFocused()
    await expect(equivalent).toHaveAttribute('href', `${copy.otherPrefix}/login/patient`)
    await page.screenshot({ path: info.outputPath(`language-menu-${copy.locale}-320x400.png`) })
    await page.keyboard.press('Escape')
    await expect(language).toBeFocused()

    for (const width of [320, 375, 640, 768, 1024]) {
      await page.setViewportSize({ width, height: width === 320 ? 400 : 720 })
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: info.outputPath(`navigation-${copy.locale}-${width}.png`) })
    }

    const desktopNav = header.getByRole('navigation', { name: copy.mainNav })
    const comparison = desktopNav.getByRole('link', { name: copy.comparison })
    await comparison.focus()
    await expect(comparison).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(new RegExp(`${comparisonPath}$`))
    await expectNoBrowserIssues(browserIssues)
  })

  test(`uses a real 404 and matching document language for an unknown ${copy.locale} URL @smoke`, async ({
    context,
    page,
  }, info) => {
    await setCookieConsent(context)
    await page.setViewportSize({ width: 320, height: 400 })
    const response = await page.goto(`${copy.prefix}/e2e-unknown-navigation-page`)
    expect(response?.status()).toBe(404)
    await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
    await expect(page.getByRole('heading', { name: '404' })).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await page.screenshot({ path: info.outputPath(`not-found-${copy.locale}-320x400.png`) })
  })
}

test('an unpublished English CMS translation points to the published German page @smoke', async ({
  context,
  page,
  request,
}, info) => {
  test.skip(process.env.E2E_NAVIGATION_SCENARIO !== 'german-only', 'Requires the German-only publication fixture')

  execFileSync(process.execPath, ['--import', 'tsx', 'scripts/public-e2e-navigation-language-fixture.ts'], {
    env: { ...process.env, NODE_ENV: 'test' },
    stdio: 'inherit',
    timeout: 30_000,
  })
  await setCookieConsent(context)
  await page.setViewportSize({ width: 320, height: 400 })
  const germanPath = `/${navigationLanguageScenario.germanOnlyPage}`
  const englishPath = `/en${germanPath}`

  const german = await request.get(germanPath)
  expect(german.status()).toBe(200)
  expect(await german.text()).not.toMatch(/<link[^>]+hreflang="en"/i)
  const sitemap = await request.get('/pages-sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).not.toContain(englishPath)

  const response = await page.goto(englishPath)
  expect(response?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
  await expect(page.locator('link[hreflang]')).toHaveCount(0)
  const germanLink = page.getByRole('main').getByRole('link', { name: 'Read in German', exact: true })
  await expect(germanLink).toHaveAttribute('href', germanPath)
  await expect(germanLink).toHaveAttribute('hreflang', 'de')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
  await page.screenshot({ path: info.outputPath('translation-unavailable-en-320x400.png') })

  await page
    .getByRole('banner')
    .getByRole('button', { name: /Language/ })
    .click()
  const alternatives = page.getByRole('dialog', { name: 'Language' })
  await expect(alternatives.getByRole('link', { name: 'Deutsch', exact: true })).toHaveAttribute('href', germanPath)
  await expect(alternatives.getByRole('link', { name: 'English', exact: true })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await germanLink.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
})
