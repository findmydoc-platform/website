import { expect, test } from '@playwright/test'

import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  openAdminCreatePage,
  openAdminJoinCreateDrawer,
  selectComboboxOption,
} from '../helpers/adminUI'
import { ensureClinicFixture } from '../helpers/adminFixtures'

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const STANDARD_HINT = 'Accepted formats: JPG, PNG, WebP, AVIF, GIF, SVG. Maximum file size: 4 MB.'
const GALLERY_HINT = 'Accepted formats: JPG, PNG, WebP, AVIF, GIF. Maximum file size: 4 MB.'
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
  'base64',
)

test.describe.configure({ mode: 'serial' })

test('shows the configured upload policy on all five media forms @smoke', async ({ page }) => {
  const collections = [
    ['clinicMedia', STANDARD_HINT],
    ['clinicGalleryMedia', GALLERY_HINT],
    ['doctorMedia', STANDARD_HINT],
    ['platformContentMedia', STANDARD_HINT],
    ['userProfileMedia', STANDARD_HINT],
  ] as const

  for (const [collectionSlug, hint] of collections) {
    await openAdminCreatePage(page, collectionSlug)
    await expect(page.getByText(hint, { exact: true })).toBeVisible()
  }
})

test('shows the gallery upload policy inside the relationship drawer @smoke', async ({ page }) => {
  const clinic = await ensureClinicFixture(page.request)
  await openAdminCreatePage(page, 'clinicGalleryEntries')
  await selectComboboxOption(page, 'Clinic', clinic.clinicName)

  const drawer = await openAdminJoinCreateDrawer(page, 'beforeMedia')

  await expect(drawer.getByText(GALLERY_HINT, { exact: true })).toBeVisible()

  const narrowViewports = [
    { height: 568, width: 320 },
    { height: 667, width: 375 },
    { height: 844, width: 390 },
    { height: 800, width: 640 },
    { height: 1024, width: 768 },
  ]

  for (const viewport of narrowViewports) {
    await page.setViewportSize(viewport)
    await expect(drawer.getByText(GALLERY_HINT, { exact: true })).toBeVisible()
    expect(
      await drawer.locator('.policy-aware-upload').evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true)
  }
})

test('rejects invalid gallery files and saves a valid PNG @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/TypeError: Failed to fetch/, /TypeError: network error/],
  })
  const fileName = `upload-policy-${Date.now()}.png`
  const clinic = await ensureClinicFixture(page.request)

  await openAdminCreatePage(page, 'clinicGalleryMedia')
  const fileInput = page.locator('input[type="file"]').first()

  await fileInput.setInputFiles({
    name: 'too-large.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(MAX_UPLOAD_BYTES + 1),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'Image is too large.' }).first()).toContainText(
    'Image is too large. Maximum file size is 4 MB.',
  )
  await expect(fileInput).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Select a file' })).toBeFocused()

  await page.setViewportSize({ height: 568, width: 320 })
  const policyAwareUpload = page.locator('.policy-aware-upload')
  expect(await policyAwareUpload.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.setViewportSize({ height: 720, width: 1280 })

  await fileInput.setInputFiles({
    name: 'unsupported.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
  })
  await expect(page.getByRole('alert').filter({ hasText: 'Unsupported image format.' }).first()).toContainText(
    'Unsupported image format. Accepted formats: JPG, PNG, WebP, AVIF, GIF.',
  )
  await expect(fileInput).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Select a file' })).toBeFocused()

  await fileInput.setInputFiles({ name: fileName, mimeType: 'image/png', buffer: TINY_PNG })
  await page.getByLabel(/^Alt Text/).fill('Upload policy smoke test')
  await selectComboboxOption(page, 'Clinic', clinic.clinicName)
  await page.getByRole('button', { name: /^Save$/ }).click()
  await page.waitForURL(/\/admin\/collections\/clinicGalleryMedia\/[^/]+$/)

  await expectNoBrowserIssues(issues)
})
