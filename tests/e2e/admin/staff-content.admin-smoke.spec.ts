import { expect, test } from '@playwright/test'

import { readAdminCredentialsFromEnv } from '../helpers/adminSession'
import { getRecordId } from '../helpers/adminApi'
import { createTinyPngFile } from '../../fixtures/mediaFile'
import {
  createBrowserIssueCollector,
  expectNoBrowserIssues,
  getAdminDocumentDrawer,
  getAdminFieldRoot,
  openAdminCollectionPage,
  openAdminCreatePage,
  saveAdminDrawerDocument,
} from '../helpers/adminUI'

test.describe.configure({ mode: 'serial' })

test('platform staff can identify managed staff accounts @smoke', async ({ page }) => {
  const credentials = readAdminCredentialsFromEnv()
  const issues = createBrowserIssueCollector(page)

  await openAdminCollectionPage(page, 'platformStaff')
  await expect(page.getByText('Managed platform account')).toBeVisible()
  await expect(page.getByText(credentials.email, { exact: true }).first()).toBeVisible()

  await openAdminCollectionPage(page, 'clinicStaff')
  await expect(page.getByText('Managed clinic account')).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('platform staff can upload and persist their account image @smoke', async ({ page }, testInfo) => {
  const issues = createBrowserIssueCollector(page)
  await page.goto('/admin/account')
  const meResponse = await page.request.get('/api/platformStaff/me?depth=0')
  expect(meResponse.ok()).toBeTruthy()
  const { user } = (await meResponse.json()) as { user: { id: number; profileImage?: unknown } }
  const previousImage = getRecordId(user.profileImage) ?? null
  let uploadedImage: number | string | undefined

  try {
    const clearResponse = await page.request.patch(`/api/platformStaff/${user.id}`, {
      data: { profileImage: null },
    })
    expect(clearResponse.ok()).toBeTruthy()
    await page.reload()

    const field = getAdminFieldRoot(page, 'profileImage')
    await expect(field.getByRole('button', { name: 'Create New', exact: true })).toBeEnabled()
    await field.getByRole('button', { name: 'Create New', exact: true }).click()
    const drawer = getAdminDocumentDrawer(page)
    const chooser = page.waitForEvent('filechooser')
    await drawer.getByRole('button', { name: 'Select a file', exact: true }).click()
    const image = createTinyPngFile(`account-image-${Date.now()}.png`)
    await (await chooser).setFiles({ name: image.name, buffer: image.data, mimeType: image.mimetype })

    const uploadResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/userProfileMedia',
    )
    await saveAdminDrawerDocument(page)
    const upload = await uploadResponse
    expect(upload.ok()).toBeTruthy()
    const uploaded = (await upload.json()) as { doc: { id: number | string } }
    uploadedImage = uploaded.doc.id

    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' && new URL(response.url()).pathname === `/api/platformStaff/${user.id}`,
    )
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    expect((await saved).ok()).toBeTruthy()
    await page.reload()
    await expect(getAdminFieldRoot(page, 'profileImage').getByRole('link', { name: image.name })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('account-profile-image.png'), fullPage: true })
    await expectNoBrowserIssues(issues)
  } finally {
    const restore = await page.request.patch(`/api/platformStaff/${user.id}`, {
      data: { profileImage: previousImage },
    })
    expect(restore.ok()).toBeTruthy()
    if (uploadedImage !== undefined) {
      const cleanup = await page.request.delete(`/api/userProfileMedia/${uploadedImage}`)
      expect(cleanup.ok()).toBeTruthy()
    }
  }
})

test('platform staff can open content creation forms @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  for (const collectionSlug of ['posts', 'pages']) {
    await openAdminCreatePage(page, collectionSlug)
    await expect(page.getByRole('textbox', { name: /^Title\b/i })).toBeVisible()
  }

  await expectNoBrowserIssues(issues)
})
