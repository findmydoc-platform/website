import { expect, test } from '@playwright/test'
import { readAdminCredentialsFromEnv, toFixedAdminAccessError } from '../helpers/adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues, loginAsAdmin } from '../helpers/adminUI'

test('staff login succeeds for a fixed platform admin @smoke', async ({ page, context }) => {
  const credentials = readAdminCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  try {
    await context.clearCookies()
    await loginAsAdmin(page, credentials)

    await expect(page).toHaveURL(/\/admin(?:\/)?$/)
    await expect(page.getByRole('link', { name: 'Clinics' }).first()).toBeVisible()
    await expectNoBrowserIssues(issues)
  } catch (error) {
    throw toFixedAdminAccessError(error)
  }
})
