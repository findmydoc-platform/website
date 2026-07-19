import { expect, test } from '@playwright/test'

import { readAdminCredentialsFromEnv } from '../helpers/adminSession'
import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  openAdminCollectionPage,
  openAdminCreatePage,
} from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('platform staff can identify managed staff accounts @smoke', async ({ page }) => {
  const credentials = readAdminCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  await openAdminCollectionPage(page, 'platformStaff')
  await expect(page.getByText('Managed platform account')).toBeVisible()
  await expect(page.getByText(credentials.email, { exact: true }).first()).toBeVisible()

  await openAdminCollectionPage(page, 'clinicStaff')
  await expect(page.getByText('Managed clinic account')).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can open content creation forms @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  for (const collectionSlug of ['posts', 'pages']) {
    await openAdminCreatePage(page, collectionSlug)
    await expect(page.getByLabel(/^Title(?:\s*\*)?$/i)).toBeVisible()
  }

  await expectNoBrowserIssues(issues)
})
