import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
  await setCookieConsent(context)
})

test('blog index shows visible breadcrumbs @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/posts', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Our Blog' })).toBeVisible()

  const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
  await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible()
  await expect(breadcrumb.getByText('Blog')).toHaveAttribute('aria-current', 'page')

  await expectNoBrowserIssues(issues)
})
