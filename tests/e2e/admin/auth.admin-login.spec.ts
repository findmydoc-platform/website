import { expect, test } from '@playwright/test'
import { readAdminCredentialsFromEnv, toFixedAdminAccessError } from '../helpers/adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues, loginToAdmin } from '../helpers/adminUI'
import { setCookieConsent } from '../helpers/cookieConsent'

test('staff login succeeds for a fixed platform admin @smoke', async ({ page, context }) => {
  const credentials = readAdminCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  try {
    await context.clearCookies()
    await setCookieConsent(context)
    await loginToAdmin(page, credentials)

    await expect(page).toHaveURL(/\/admin(?:\/)?$/)
    await expect(page.getByRole('link', { name: 'Clinics' }).first()).toBeVisible()
    await expectNoBrowserIssues(issues)
  } catch (error) {
    throw toFixedAdminAccessError(error)
  }
})
