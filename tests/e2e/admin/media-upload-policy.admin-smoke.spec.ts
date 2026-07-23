import { expect, test } from '@playwright/test'

import { openAdminCreatePage } from '../helpers/adminUI'

const STANDARD_HINT = 'Accepted formats: JPG, PNG, WebP, AVIF, GIF, SVG. Maximum file size: 4 MB.'

test.describe.configure({ mode: 'serial' })

test('shows the configured upload policy on all active media forms @smoke', async ({ page }) => {
  const collections = [
    ['clinicMedia', STANDARD_HINT],
    ['doctorMedia', STANDARD_HINT],
    ['platformContentMedia', STANDARD_HINT],
    ['userProfileMedia', STANDARD_HINT],
  ] as const

  for (const [collectionSlug, hint] of collections) {
    await openAdminCreatePage(page, collectionSlug)
    await expect(page.getByText(hint, { exact: true })).toBeVisible()
  }
})
