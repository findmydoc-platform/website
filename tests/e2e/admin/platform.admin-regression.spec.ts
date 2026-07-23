import { expect, test } from '@playwright/test'
import { getAdminJourneyDefinition, executeAdminJourney } from '../helpers/adminJourneys'
import { createBrowserIssueCollector, expectNoBrowserIssues, getAdminFieldRoot, openAdminTab } from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('platform staff sees and completes clinic approval requirements @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/status of 400.*\/api\/clinics\//, /server responded with a status of 400/i],
  })
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.clinics.approve-pending'), {
    mode: 'regression',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(result.state.clinicId).toBeTruthy()
  await expect(page.getByText('All requirements are complete.')).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff sees valid clinic staff transitions and structured API validation @regression', async ({
  page,
}) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.clinic-staff.lifecycle-guidance'), {
    mode: 'regression',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(result.state.clinicStaffId).toBeTruthy()
  await expect(page.getByText('Saving disables the Supabase identity.')).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff sees clinic application provisioning guidance without starting provisioning @regression', async ({
  page,
}) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(
    getAdminJourneyDefinition('admin.clinic-applications.provisioning-guidance'),
    {
      mode: 'regression',
      page,
      persona: 'admin',
      request: page.request,
    },
  )

  await expect(result.state.applicationId).toBeTruthy()
  await expect(page.getByText('Provisioning pending', { exact: true })).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff sees the patient requirement while creating a review @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/status of 400.*\/api\/reviews(?:\?|$)/, /server responded with a status of 400/i],
  })
  await executeAdminJourney(getAdminJourneyDefinition('admin.reviews.validate-patient'), {
    mode: 'regression',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(page.getByText('Patient is required when creating a review.')).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff sees only eligible doctor and specialty relationships @regression', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  await executeAdminJourney(getAdminJourneyDefinition('admin.relationships.validate-eligibility'), {
    mode: 'regression',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expectNoBrowserIssues(issues)
})

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
  await expect(result.state.clinicTreatmentId).toBeTruthy()
  await expect(result.state.doctorTreatmentId).toBeTruthy()
  await openAdminTab(page, 'Treatment Details')
  await expect(getAdminFieldRoot(page, 'averagePrice').getByRole('spinbutton')).toHaveValue(result.state.price)
  await expectNoBrowserIssues(issues)
})
