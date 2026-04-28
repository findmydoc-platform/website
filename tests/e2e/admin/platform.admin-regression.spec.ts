import { expect, test } from '@playwright/test'
import { getAdminJourneyDefinition, executeAdminJourney } from '../helpers/adminJourneys'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('platform staff can run the medical-network dependency chain @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })

  const result = await executeAdminJourney(
    getAdminJourneyDefinition('admin.medical-network.create-specialty-and-link-doctor'),
    {
      mode: 'regression',
      page,
      persona: 'admin',
      request: page.request,
    },
  )

  await expect(result.state.specialtyName).toBeTruthy()
  await expect(result.state.doctorFullName).toBeTruthy()
  await expect(result.state.doctorSpecialtyId).toBeTruthy()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a treatment and link clinic and doctor relations @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })

  const result = await executeAdminJourney(
    getAdminJourneyDefinition('admin.medical-network.create-treatment-and-link-clinic-and-doctor'),
    {
      mode: 'regression',
      page,
      persona: 'admin',
      request: page.request,
    },
  )

  await expect(result.state.treatmentId).toBeTruthy()
  await expect(result.state.treatmentName).toBeTruthy()
  await expect(result.state.clinicTreatmentId).toBeTruthy()
  await expect(result.state.doctorTreatmentId).toBeTruthy()
  await expect(page.getByLabel('Average Price')).toHaveValue(result.state.price)
  await expectNoBrowserIssues(issues)
})
