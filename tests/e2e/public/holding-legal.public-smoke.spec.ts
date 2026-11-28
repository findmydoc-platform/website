import { expect, test } from '@playwright/test'

import { setCookieConsent } from '../helpers/cookieConsent'

const scenario = process.env.E2E_HOLDING_LEGAL_SCENARIO
const germanPublished = scenario === 'bilingual'

test.skip(scenario !== 'bilingual' && scenario !== 'english-only', 'Requires a Holding legal publication fixture')

for (const slug of ['imprint', 'privacy-policy']) {
  test(`Holding routes and links for ${slug} @holding-legal`, async ({ context, page, request }, testInfo) => {
    test.setTimeout(120_000)
    await setCookieConsent(context)
    await page.setViewportSize({ width: 375, height: 400 })
    const germanPath = `/${slug}`
    const englishPath = `/en/${slug}`

    for (const [home, locale, legalPath] of [
      ['/', 'de', germanPublished ? germanPath : englishPath],
      ['/en', 'en', englishPath],
    ] as const) {
      const response = await request.get(legalPath, { maxRedirects: 0 })
      expect(response.status()).toBe(200)
      expect(response.headers()['x-robots-tag']).toContain('noindex')

      await page.goto(home, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('html')).toHaveAttribute('lang', locale)
      const link = page
        .getByRole('main')
        .getByRole('link')
        .and(page.locator(`a[href="${legalPath}"]`))
      await link.scrollIntoViewIfNeeded()

      const legalLocale = legalPath === germanPath ? 'de' : 'en'
      if (legalLocale !== locale) await expect(link).toHaveAccessibleName(/\(EN\)$/)

      for (const width of [320, 375, 640, 768, 1024]) {
        await page.setViewportSize({ width, height: 720 })
        await expect(link).toBeVisible()
        await link.scrollIntoViewIfNeeded()
        await expect
          .poll(() =>
            link.evaluate((anchor) => {
              const { right, top, height } = anchor.getBoundingClientRect()
              return anchor.contains(document.elementFromPoint(right - 2, top + height / 2))
            }),
          )
          .toBe(true)
        await page.screenshot({ path: testInfo.outputPath(`holding-${locale}-${slug}-${width}.png`) })
      }

      await link.click()
      await expect(page).toHaveURL(new RegExp(`${legalPath}$`), { timeout: 20_000 })
      await expect(page.locator('html')).toHaveAttribute('lang', legalLocale)
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${legalPath}$`))
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
      if (legalLocale === 'de') {
        await expect(page.getByText(`Deutsche Testfassung (${slug})`, { exact: true })).toBeVisible()
      }
    }

    if (!germanPublished) {
      const response = await request.get(germanPath, { maxRedirects: 0 })
      expect(response.headers()['x-robots-tag']).toContain('noindex')
      if (response.ok()) {
        // Existing English legal documents may still answer their legacy unprefixed URL.
        await page.goto(germanPath)
        await expect(page.locator('html')).toHaveAttribute('lang', 'en')
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${englishPath}$`))
      } else {
        expect(response.status()).toBe(404)
      }
    }

    const sitemap = await request.get('/pages-sitemap.xml')
    expect(sitemap.status()).toBe(200)
    const sitemapXml = await sitemap.text()
    expect(sitemapXml).toMatch(/<loc>[^<]+\/en<\/loc>/)
    expect(sitemapXml).not.toContain(`${germanPath}</loc>`)
  })
}
