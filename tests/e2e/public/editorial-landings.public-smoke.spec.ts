import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'
import { E2E_OUTPUT_DIR } from '../helpers/paths'

const pages = [
  { de: '/about', en: '/en/about' },
  { de: '/partners/clinics', en: '/en/partners/clinics' },
] as const

const viewports = [
  { width: 320, height: 760 },
  { width: 375, height: 812 },
  { width: 640, height: 900 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1280, height: 720 },
  { width: 375, height: 640 },
] as const

for (const locale of ['de', 'en'] as const) {
  for (const destinations of pages) {
    const route = destinations[locale]

    test(`${route} publishes the route language and localized destination links @smoke`, async ({ page, context }) => {
      test.setTimeout(120_000)
      await setCookieConsent(context)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const issues = createBrowserIssueCollector(page)
      const response = await page.goto(route, { waitUntil: 'domcontentloaded' })

      expect(response?.status()).toBe(200)
      expect(await response?.text()).toMatch(new RegExp(`<html[^>]* lang="${locale}"`))
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const origin = new URL(page.url()).origin
      await expect(page.locator('main section img').first()).toHaveAttribute('alt', /\S/)
      await expect(page).toHaveTitle(/\S/)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /\S/)
      const canonical = page.locator('link[rel="canonical"]')
      await expect(canonical).toHaveAttribute('href', origin + route)
      for (const [language, href] of Object.entries({ ...destinations, 'x-default': destinations.de })) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${language}"]`)).toHaveAttribute(
          'href',
          origin + href,
        )
      }

      const isAbout = destinations.de === '/about'
      for (const viewport of viewports) {
        await page.setViewportSize(viewport)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/\S/)
        const fits = await page.evaluate(
          () => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) <= window.innerWidth + 1,
        )
        expect(fits, `${route} overflows at ${viewport.width}×${viewport.height}`).toBe(true)
      }

      await page.setViewportSize({ width: 375, height: 640 })
      await page.screenshot({
        path: `${E2E_OUTPUT_DIR}/artifacts/editorial-${isAbout ? 'about' : 'partners'}-${locale}.png`,
      })
      if (isAbout) {
        const partnerLink = page
          .locator('section[aria-labelledby="about-closing-actions-heading"] a')
          .filter({ hasText: /\S/ })
          .last()
        await expect(partnerLink).toHaveAttribute('href', pages[1][locale])
        await partnerLink.click()
        await expect(page).toHaveURL(origin + pages[1][locale])
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
      } else {
        await page.locator('main a[href="#contact"]').click()
        await expect(page).toHaveURL(origin + route + '#contact')
        const application = page.locator('#contact form')
        const clinicName = application.locator('input[name="clinicName"]')
        await expect(clinicName).toBeVisible()
        await expect(clinicName).toHaveAccessibleName(/\S/)
        await application.getByRole('button').click()
        await expect(clinicName).toHaveAttribute('aria-invalid', 'true')
        await page.screenshot({ path: `${E2E_OUTPUT_DIR}/artifacts/editorial-application-${locale}.png` })
      }

      await expectNoBrowserIssues(issues)
    })
  }
}
