import path from 'node:path'
import { expect, test } from '@playwright/test'
import { getPayload } from 'payload'
import config from '@payload-config'
import { E2E_OUTPUT_DIR } from '../helpers/paths'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/adminUI'

test('limits collection navigation, routes, and APIs by operational purpose and staff role @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)
  page.setDefaultTimeout(10_000)
  const issues = createBrowserIssueCollector(page)
  const payload = await getPayload({ config })
  const staff = (
    await payload.find({
      collection: 'platformStaff',
      depth: 0,
      limit: 1,
      where: { email: { equals: process.env.E2E_ADMIN_EMAIL } },
      overrideAccess: true,
    })
  ).docs[0]
  if (!staff) throw new Error('Expected the existing local E2E platform administrator')

  const navigate = async () => {
    await page.goto('/admin/collections/authActions', { waitUntil: 'networkidle' })
    await expect(page.getByRole('heading', { name: 'Auth Actions', exact: true })).toBeVisible()
    await expect(page.locator('a[href="/admin/collections/clinicProfileDrafts"]')).toHaveCount(0)
    await expect(page.locator('a[href="/admin/collections/favoriteclinics"]')).toHaveCount(0)
  }
  const captureMenu = async (filename: string) => {
    const open = page
      .getByRole('button', { name: /^open menu$/i })
      .filter({ visible: true })
      .first()
    if (await open.isVisible()) await open.click()
    await expect(
      page
        .getByRole('button', { name: /^close menu$/i })
        .filter({ visible: true })
        .first(),
    ).toBeVisible()
    await page.screenshot({ path: path.join(E2E_OUTPUT_DIR, filename), fullPage: false, animations: 'disabled' })
    await page
      .getByRole('button', { name: /^close menu$/i })
      .filter({ visible: true })
      .first()
      .click()
  }

  await navigate()
  expect((await page.request.get('/api/payload-mcp-api-keys')).status()).toBe(200)
  expect((await page.request.get('/api/clinicProfileDrafts')).status()).toBe(403)
  for (const slug of ['clinicProfileDrafts', 'favoriteclinics']) {
    expect((await page.request.get(`/admin/collections/${slug}`)).status()).toBe(404)
  }
  await captureMenu('admin-collections-desktop.png')

  try {
    for (const role of ['support', 'content-manager'] as const) {
      await payload.update({
        collection: 'platformStaff',
        id: staff.id,
        data: { role },
        overrideAccess: true,
        context: { trustedPlatformStaffOps: true },
      })
      await navigate()
      await expect(page.locator('a[href="/admin/collections/payload-mcp-api-keys"]')).toHaveCount(0)
      expect((await page.request.get('/api/payload-mcp-api-keys')).status()).toBe(403)
      expect((await page.request.get('/admin/collections/payload-mcp-api-keys')).status()).toBe(404)
      expect((await page.request.get('/api/authActions')).status()).toBe(200)

      if (role === 'support') {
        for (const width of [320, 375, 640, 768, 1024, 1280]) {
          await page.setViewportSize({ width, height: 900 })
          await navigate()
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
          if (width === 375 || width === 1280) {
            await captureMenu(`support-collections-${width}.png`)
          }
        }
        await page.setViewportSize({ width: 375, height: 500 })
        await navigate()
        const open = page
          .getByRole('button', { name: /^open menu$/i })
          .filter({ visible: true })
          .first()
        if (await open.isVisible()) await open.click()
        await page.getByRole('link', { name: 'Reviews', exact: true }).click()
        await expect(page.getByRole('heading', { name: 'Reviews', exact: true })).toBeVisible()
      }
    }
  } finally {
    await payload.update({
      collection: 'platformStaff',
      id: staff.id,
      data: { role: staff.role },
      overrideAccess: true,
      context: { trustedPlatformStaffOps: true },
    })
  }

  await expectNoBrowserIssues(issues)
})
