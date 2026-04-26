import { expect, test } from '@playwright/test'
import { getAdminJourneyDefinition, executeAdminJourney } from '../helpers/adminJourneys'
import { createBrowserIssueCollector, expectNoBrowserIssues, openAdminCollectionPage } from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('admin dashboard loads for an authenticated platform user @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/admin', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/admin(?:\/)?$/)
  await expect(page.getByRole('link', { name: 'Clinics' }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('clinic collection screen is reachable for platform staff @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await openAdminCollectionPage(page, 'clinics')

  await expect(page).toHaveURL(/\/admin\/collections\/clinics(?:\/)?$/)
  await expect(page.getByText('Clinics', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a draft clinic from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.clinics.create-draft'), {
    mode: 'smoke',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(page.getByLabel('Name')).toHaveValue(result.state.clinicName)
  await expectNoBrowserIssues(issues)
})
