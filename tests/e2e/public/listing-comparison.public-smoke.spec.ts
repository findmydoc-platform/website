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
  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(breadcrumb.getByText('Clinics')).toHaveAttribute('aria-current', 'page')

  const medicalSpecialtyToggle = page.getByRole('button', { name: /^Medical Specialty/ })
  await medicalSpecialtyToggle.click()
  await expect(medicalSpecialtyToggle).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('radiogroup', { name: 'Medical Specialty' }).getByText('Dental', { exact: true }).click()
  await waitForSearchParam(page, 'specialty', '1')
  await expect(breadcrumb.getByRole('link', { name: 'Clinics' })).toBeVisible()
  await expect(breadcrumb.getByText('Dental')).toHaveAttribute('aria-current', 'page')

  const fourStarButton = page.getByRole('button', { name: '4+ ★' })
  await fourStarButton.click()

  await waitForSearchParam(page, 'ratingMin', '4')
  await waitForSearchParam(page, 'specialty', '1')
  await expect(fourStarButton).toHaveAttribute('aria-pressed', 'true')

  const allRatingsButton = page.getByRole('button', { name: 'All', exact: true })
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

  const ratingButton = page.getByRole('button', { name: '4.5+ ★' })
  const allRatingsButton = page.getByRole('button', { name: 'All', exact: true })

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
  await expect(page.getByRole('button', { name: /Remove .* specialty filter/ })).toBeVisible()

  await page.getByRole('button', { name: /Remove .* specialty filter/ }).click()

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
  const results = page.getByRole('region', { name: 'Clinic results' })
  const rating = page.getByRole('button', { name: '4+ ★' })
  const locateSearch = (locale: 'de' | 'en') =>
    page.getByRole('textbox', { name: locale === 'de' ? 'Behandlungen suchen' : 'Search treatments' })
  const term = 'implant'

  await page.getByRole('button', { name: /^Medical Specialty/ }).click()
  await page.getByRole('radiogroup', { name: 'Medical Specialty' }).getByText('Dental', { exact: true }).click()
  await waitForSearchParam(page, 'specialty', '1')
  await rating.click()
  await waitForSearchParam(page, 'ratingMin', '4')
  await page.getByRole('button', { name: /^Behandlungen/ }).click()
  await locateSearch('de').fill(term)
  await expect(page.getByRole('checkbox', { name: /Single Dental Implant/ })).toBeVisible()
  await expect(locateSearch('de')).toHaveValue(term)
  const filteredResults = await results.getByRole('status').innerText()

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
    await expect(page.getByRole('checkbox', { name: /Single Dental Implant/ })).toBeVisible()
    await expect(results.getByRole('status')).toHaveText(filteredResults)
    expect(page.url()).not.toContain(term)
    await expect(
      page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', { name: 'Clinics' }),
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
