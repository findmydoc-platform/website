import { expect, test, type Page } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const getSearchParam = (page: Page, key: string) => new URL(page.url()).searchParams.get(key)

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
    ignoredConsoleErrors: ['Failed to load resource: the server responded with a status of 400 (Bad Request)'],
  })

  await page.goto('/listing-comparison', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Compare clinic prices' })).toBeVisible()
  await page.getByRole('checkbox', { name: 'Dental', exact: true }).click()
  await waitForSearchParam(page, 'specialty', '1')

  const fourStarButton = page.getByRole('button', { name: '4+ ★' })
  await fourStarButton.click()

  await waitForSearchParam(page, 'ratingMin', '4')
  await waitForSearchParam(page, 'specialty', '1')
  await expect(fourStarButton).toHaveClass(/bg-secondary/)

  const allRatingsButton = page.getByRole('button', { name: 'All', exact: true })
  await allRatingsButton.click()

  await waitForMissingSearchParam(page, 'ratingMin')
  await waitForSearchParam(page, 'specialty', '1')
  await expect(allRatingsButton).toHaveClass(/bg-secondary/)
  await expectNoBrowserIssues(issues)
})

test('rating filter rehydrates from the URL across browser navigation @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: ['Failed to load resource: the server responded with a status of 400 (Bad Request)'],
  })

  await page.goto('/listing-comparison?ratingMin=4.5', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Compare clinic prices' })).toBeVisible()

  const ratingButton = page.getByRole('button', { name: '4.5+ ★' })
  const allRatingsButton = page.getByRole('button', { name: 'All', exact: true })

  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveClass(/bg-secondary/)

  await page.reload({ waitUntil: 'domcontentloaded' })
  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveClass(/bg-secondary/)

  await page.goto('/listing-comparison', { waitUntil: 'domcontentloaded' })
  await waitForMissingSearchParam(page, 'ratingMin')
  await expect(allRatingsButton).toHaveClass(/bg-secondary/)

  await page.goBack()

  await waitForSearchParam(page, 'ratingMin', '4.5')
  await expect(ratingButton).toHaveClass(/bg-secondary/)
  await expectNoBrowserIssues(issues)
})

test('clearing the specialty chip also clears any selected treatments from the URL @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: ['Failed to load resource: the server responded with a status of 400 (Bad Request)'],
  })

  await page.goto('/listing-comparison?specialty=2&treatment=101', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Compare clinic prices' })).toBeVisible()
  await waitForSearchParam(page, 'specialty', '2')
  await waitForSearchParam(page, 'treatment', '101')
  await expect(page.getByRole('button', { name: /Remove .* specialty filter/ })).toBeVisible()

  await page.getByRole('button', { name: /Remove .* specialty filter/ }).click()

  await waitForMissingSearchParam(page, 'specialty')
  await waitForMissingSearchParam(page, 'treatment')
  await expectNoBrowserIssues(issues)
})
