import { expect, test } from '@playwright/test'
import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  saveAdminDocumentForCollection,
  selectComboboxOption,
  selectFirstComboboxOption,
} from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('medical specialties collection screen is reachable for platform staff @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/admin/collections/medical-specialties', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/admin\/collections\/medical-specialties(?:\/)?$/)
  await expect(page.getByText('Medical Specialties', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a medical specialty from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const specialtyName = `E2E Specialty ${Date.now()}`

  await page.goto('/admin/collections/medical-specialties/create', { waitUntil: 'domcontentloaded' })

  await page.getByLabel('Name').fill(specialtyName)
  await page.getByLabel('Description').fill('Created during Playwright admin smoke flow')

  await saveAdminDocumentForCollection(page, 'medical-specialties')

  await expect(page.getByLabel('Name')).toHaveValue(specialtyName)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a doctor specialty relation from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const specialtyName = `E2E Relation Specialty ${Date.now()}`

  await page.goto('/admin/collections/medical-specialties/create', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Name').fill(specialtyName)
  await saveAdminDocumentForCollection(page, 'medical-specialties')

  await page.goto('/admin/collections/doctorspecialties/create', { waitUntil: 'domcontentloaded' })

  await selectFirstComboboxOption(page, 'Doctor')
  await selectComboboxOption(page, 'Medical Specialty', specialtyName)
  await selectComboboxOption(page, 'Specialization Level', 'Specialist')

  await saveAdminDocumentForCollection(page, 'doctorspecialties')

  await expect(page).toHaveURL(/\/admin\/collections\/doctorspecialties\/[^/]+$/)
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a tag from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const tagName = `e2e-tag-${Date.now()}`

  await page.goto('/admin/collections/tags/create', { waitUntil: 'domcontentloaded' })
  await page.getByLabel('Name').fill(tagName)

  await saveAdminDocumentForCollection(page, 'tags')

  await expect(page.getByLabel('Name')).toHaveValue(tagName)
  await expectNoBrowserIssues(issues)
})
