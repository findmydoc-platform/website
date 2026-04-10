import { expect, test } from '@playwright/test'
import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  openAdminTab,
  saveAdminDocument,
  selectComboboxOption,
} from '../helpers/adminUI'

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

  await page.goto('/admin/collections/clinics', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveURL(/\/admin\/collections\/clinics(?:\/)?$/)
  await expect(page.getByText('Clinics', { exact: true }).first()).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can create a draft clinic from the admin UI @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const clinicName = `E2E Clinic ${Date.now()}`

  await page.goto('/admin/collections/clinics/create', { waitUntil: 'domcontentloaded' })

  await page.getByLabel('Name').fill(clinicName)

  await openAdminTab(page, 'Address')
  await page.getByLabel('Street').fill('Smoke Street')
  await page.getByLabel('House Number').fill('12A')
  await page.getByLabel('Zip Code').fill('34000')
  await selectComboboxOption(page, 'City', 'Istanbul')

  await openAdminTab(page, 'Contact')
  await page.getByLabel('Phone Number').fill('+90 555 0000000')
  await page.getByLabel('Email').fill(`admin-e2e+${Date.now()}@example.com`)

  await openAdminTab(page, 'Details & Status')
  await selectComboboxOption(page, 'Supported Languages', 'English')

  await saveAdminDocument(page)

  await expect(page.getByLabel('Name')).toHaveValue(clinicName)
  await expectNoBrowserIssues(issues)
})
