import { expect, test, type Page } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const getSearchParam = (page: Page, key: string) => new URL(page.url()).searchParams.get(key)
const missingListingMediaError =
  /Failed to load resource: the server responded with a status of 400 .*\/api\/clinicMedia\/file\//

async function waitForSearchParam(page: Page, key: string, value: string) {
  await expect.poll(() => getSearchParam(page, key)).toBe(value)
}

async function waitForMissingSearchParam(page: Page, key: string) {
  await expect.poll(() => new URL(page.url()).searchParams.has(key)).toBe(false)
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
  await setCookieConsent(context)
})

test('listing filters preserve the selected specialty when rating changes @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    // Baseline listing cards reference seeded clinic media that is not present in the lightweight local E2E dataset.
    ignoredConsoleErrors: [missingListingMediaError],
  })

  await page.goto('/listing-comparison', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  const breadcrumb = page.getByRole('navigation', { name: 'Brotkrümelnavigation' })
  await expect(breadcrumb.getByRole('link', { name: 'Startseite' })).toBeVisible()
  await expect(breadcrumb.getByText('Kliniken')).toHaveAttribute('aria-current', 'page')

  const medicalSpecialtyToggle = page.getByRole('button', { name: /^Medizinisches Fachgebiet/ })
  await medicalSpecialtyToggle.click()
  await expect(medicalSpecialtyToggle).toHaveAttribute('aria-expanded', 'true')
  await page
    .getByRole('radiogroup', { name: 'Medizinisches Fachgebiet' })
    .getByText('Zahnmedizin', { exact: true })
    .click()
  await waitForSearchParam(page, 'specialty', '1')
  await expect(breadcrumb.getByRole('link', { name: 'Kliniken' })).toBeVisible()
  await expect(breadcrumb.getByText('Zahnmedizin')).toHaveAttribute('aria-current', 'page')

  const fourStarButton = page.getByRole('button', { name: '4+ ★' })
  await fourStarButton.click()

  await waitForSearchParam(page, 'ratingMin', '4')
  await waitForSearchParam(page, 'specialty', '1')
  await expect(fourStarButton).toHaveAttribute('aria-pressed', 'true')

  const allRatingsButton = page.getByRole('button', { name: 'Alle', exact: true })
  await allRatingsButton.click()

  await waitForMissingSearchParam(page, 'ratingMin')
  await waitForSearchParam(page, 'specialty', '1')
  await expect(allRatingsButton).toHaveAttribute('aria-pressed', 'true')
  await expectNoBrowserIssues(issues)
})

test('rating filter rehydrates from the URL across browser navigation @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [missingListingMediaError],
  })

  await page.goto('/listing-comparison?ratingMin=4.5', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const ratingButton = page.getByRole('button', { name: '4,5+ ★' })
  const allRatingsButton = page.getByRole('button', { name: 'Alle', exact: true })

  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveAttribute('aria-pressed', 'true')

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveAttribute('aria-pressed', 'true')

  await page.goto('/listing-comparison', { waitUntil: 'domcontentloaded' })
  await waitForMissingSearchParam(page, 'ratingMin')
  await expect(allRatingsButton).toHaveAttribute('aria-pressed', 'true')

  await page.goBack()

  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveAttribute('aria-pressed', 'true')
  await expectNoBrowserIssues(issues)
})

test('clearing the specialty chip also clears any selected treatments from the URL @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [missingListingMediaError],
  })

  await page.goto('/listing-comparison?specialty=2&treatment=101', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await waitForSearchParam(page, 'specialty', '2')
  await waitForSearchParam(page, 'treatment', '101')
  await expect(page.getByRole('button', { name: /Filter für .* entfernen/ })).toBeVisible()

  await page.getByRole('button', { name: /Filter für .* entfernen/ }).click()

  await waitForMissingSearchParam(page, 'specialty')
  await waitForMissingSearchParam(page, 'treatment')
  await expectNoBrowserIssues(issues)
})

test('switching the listing language keeps the treatment search and result filters in both directions @smoke', async ({
  page,
}, testInfo) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [missingListingMediaError],
  })
  await page.goto('/listing-comparison', { waitUntil: 'domcontentloaded' })

  const header = page.getByRole('banner')
  const results = (locale: 'de' | 'en') =>
    page.getByRole('region', { name: locale === 'de' ? 'Klinikergebnisse' : 'Clinic results' })
  const rating = page.getByRole('button', { name: '4+ ★' })
  const locateSearch = (locale: 'de' | 'en') =>
    page.getByRole('textbox', { name: locale === 'de' ? 'Behandlungen suchen' : 'Search treatments' })
  const term = 'einzelzahn'

  await page.getByRole('button', { name: /^Medizinisches Fachgebiet/ }).click()
  await page
    .getByRole('radiogroup', { name: 'Medizinisches Fachgebiet' })
    .getByText('Zahnmedizin', { exact: true })
    .click()
  await waitForSearchParam(page, 'specialty', '1')
  await rating.click()
  await waitForSearchParam(page, 'ratingMin', '4')
  await page.getByRole('button', { name: /^Behandlungen/ }).click()
  await locateSearch('de').fill(term)
  await expect(page.getByRole('checkbox', { name: /Einzelzahnimplantat/ })).toBeVisible()
  await expect(locateSearch('de')).toHaveValue(term)
  const filteredClinics = await results('de').getByRole('heading', { level: 3 }).allTextContents()

  for (const [locale, fromLabel, targetLabel, pathname] of [
    ['en', 'Sprache', 'English', '/en/listing-comparison'],
    ['de', 'Language', 'Deutsch', '/listing-comparison'],
  ] as const) {
    const treatmentSearch = locateSearch(locale)
    await header.getByRole('button', { name: new RegExp(fromLabel) }).click()
    await page.getByRole('dialog', { name: fromLabel }).getByRole('link', { name: targetLabel }).click()
    await expect(page).toHaveURL((url) => url.pathname === pathname)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await waitForSearchParam(page, 'specialty', '1')
    await waitForSearchParam(page, 'ratingMin', '4')
    await expect(rating).toHaveAttribute('aria-pressed', 'true')
    await expect(treatmentSearch).toHaveValue(term)
    await expect(
      page.getByRole('checkbox', { name: locale === 'de' ? /Einzelzahnimplantat/ : /Single Dental Implant/ }),
    ).toBeVisible()
    if (filteredClinics.length > 0) {
      await expect(results(locale).getByRole('heading', { level: 3 })).toHaveText(filteredClinics)
    } else {
      await expect(results(locale)).toContainText(
        locale === 'de' ? 'Keine Kliniken entsprechen diesen Filtern.' : 'No clinics match these filters.',
      )
    }
    await expect(results(locale).getByRole('status')).toHaveText(locale === 'de' ? /angezeigt/ : /^Showing/)
    await expect(page.getByRole('combobox', { name: locale === 'de' ? 'Sortieren' : 'Sort' })).toBeVisible()
    expect(page.url()).not.toContain(term)
    await expect(
      page
        .getByRole('navigation', { name: locale === 'de' ? 'Brotkrümelnavigation' : 'Breadcrumb' })
        .getByRole('link', { name: locale === 'de' ? 'Kliniken' : 'Clinics' }),
    ).toHaveAttribute('href', pathname)
    await treatmentSearch.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: testInfo.outputPath(`listing-language-${locale}.png`),
      animations: 'disabled',
      style: 'nextjs-portal { display: none; }',
    })
  }

  await page.getByRole('button', { name: 'Behandlungssuche löschen' }).click()
  await expect(locateSearch('de')).toHaveValue('')
  await expect(locateSearch('de')).toBeFocused()

  await expectNoBrowserIssues(issues)
})

test('both comparison bases are discoverable and shared variants stay noindex @smoke', async ({ page, request }) => {
  const basePaths = { de: '/listing-comparison', en: '/en/listing-comparison' }
  for (const locale of ['de', 'en'] as const) {
    const base = basePaths[locale]
    const title = locale === 'de' ? 'Klinikpreise vergleichen' : 'Compare clinic prices'
    const baseResponse = await page.goto(base)
    expect(baseResponse?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible()
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${base}$`))
    await expect(page.locator('link[rel="alternate"][hreflang="de"]')).toHaveAttribute('href', /\/listing-comparison$/)
    await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute(
      'href',
      /\/en\/listing-comparison$/,
    )
    await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
      'href',
      /\/listing-comparison$/,
    )
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)

    const variantResponse = await page.goto(`${base}?ratingMin=4&sort=rating-desc`)
    expect(variantResponse?.status()).toBe(200)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`${base}$`))
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    await expect(page.getByRole('button', { name: '4+ ★' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('combobox', { name: locale === 'de' ? 'Sortieren' : 'Sort' })).toHaveText(
      locale === 'de' ? 'Beste Bewertung' : 'Highest rated',
    )
  }

  const response = await request.get('/pages-sitemap.xml')
  expect(response.ok()).toBeTruthy()
  const sitemap = await response.text()
  for (const path of Object.values(basePaths)) {
    expect(sitemap).toContain(`${path}</loc>`)
    expect(sitemap).not.toContain(`${path}?`)
  }
})

test('comparison text and keyboard controls fit at 320 CSS pixels @smoke', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 760 })
  const issues = createBrowserIssueCollector(page, { ignoredConsoleErrors: [missingListingMediaError] })
  for (const [locale, path, specialty] of [
    ['de', '/listing-comparison', 'Medizinisches Fachgebiet'],
    ['en', '/en/listing-comparison', 'Medical Specialty'],
  ] as const) {
    await page.goto(path)
    const filter = page.getByRole('button', { name: new RegExp(`^${specialty}`) })
    await filter.focus()
    await expect(filter).toBeFocused()
    await filter.press('Enter')
    await expect(filter).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByRole('radiogroup', { name: specialty })).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`comparison-320-${locale}.png`),
      animations: 'disabled',
      style: 'nextjs-portal { display: none; }',
    })
  }
  await expectNoBrowserIssues(issues)
})
