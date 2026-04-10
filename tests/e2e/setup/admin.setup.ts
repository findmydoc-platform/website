import { expect, test } from '@playwright/test'
import { readAdminCredentialsFromEnv, toFixedAdminAccessError } from '../helpers/adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues, loginAsAdmin } from '../helpers/adminUI'
import { E2E_ADMIN_SESSION_FILE } from '../helpers/paths'

test('records reusable admin session state for the fixed platform admin @smoke', async ({ page }) => {
  const credentials = readAdminCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  try {
    await loginAsAdmin(page, credentials)
    await expect(page.getByRole('link', { name: 'Clinics' }).first()).toBeVisible()
    await page.context().storageState({ path: E2E_ADMIN_SESSION_FILE })
    await expectNoBrowserIssues(issues)
  } catch (error) {
    throw toFixedAdminAccessError(error)
  }
})
