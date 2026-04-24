import { expect, test } from '@playwright/test'
import { getAdminJourneyDefinition, executeAdminJourney } from '../helpers/adminJourneys'
import { createBrowserIssueCollector, expectNoBrowserIssues, openAdminCollectionPage } from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('medical specialties collection screen is reachable for platform staff @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await openAdminCollectionPage(page, 'medical-specialties')

  await expect(page).toHaveURL(/\/admin\/collections\/medical-specialties(?:\/)?$/)
  await expect(page.getByText('Medical Specialties', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('treatments collection screen is reachable for platform staff @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await openAdminCollectionPage(page, 'treatments')

  await expect(page).toHaveURL(/\/admin\/collections\/treatments(?:\/)?$/)
  await expect(page.getByText('Treatments', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a medical specialty from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.medical-specialties.create'), {
    mode: 'smoke',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(page.getByLabel('Name')).toHaveValue(result.state.specialtyName)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a treatment from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.treatments.create'), {
    mode: 'smoke',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(page.getByLabel('Name')).toHaveValue(result.state.treatmentName)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a doctor specialty relation from the admin UI @smoke', async ({ page }) => {
  // This save path can emit a transient server-action fetch error even when the relation is created successfully.
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.doctorspecialties.create-link'), {
    mode: 'smoke',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(result.state.doctorSpecialtyId).toBeTruthy()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a tag from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const result = await executeAdminJourney(getAdminJourneyDefinition('admin.tags.create'), {
    mode: 'smoke',
    page,
    persona: 'admin',
    request: page.request,
  })

  await expect(page.getByLabel('Name')).toHaveValue(result.state.tagName)
  await expectNoBrowserIssues(issues)
})
