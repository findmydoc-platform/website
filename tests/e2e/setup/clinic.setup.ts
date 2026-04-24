import { expect, test } from '@playwright/test'
import { ensureApprovedClinicStaffAccess } from '../helpers/adminFixtures'
import { readClinicCredentialsFromEnv, toFixedClinicAccessError } from '../helpers/adminSession'
import { createBrowserIssueCollector, expectNoBrowserIssues, loginToAdmin } from '../helpers/adminUI'
import { E2E_CLINIC_SESSION_FILE } from '../helpers/paths'

test('records reusable clinic session state for the fixed clinic staff user @regression', async ({ page }) => {
  const credentials = readClinicCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  try {
    await ensureApprovedClinicStaffAccess(page.request, { email: credentials.email })
    await page.context().clearCookies()
    await loginToAdmin(page, credentials)
    await expect(page.getByRole('link', { name: 'Clinics' }).first()).toBeVisible()
    await page.context().storageState({ path: E2E_CLINIC_SESSION_FILE })
    await expectNoBrowserIssues(issues)
  } catch (error) {
    throw toFixedClinicAccessError(error)
  }
})
