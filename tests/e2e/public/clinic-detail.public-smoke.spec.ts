import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

function runFixtureCommand(args: string[]) {
  return execFileSync('pnpm', ['dlx', 'tsx', 'scripts/public-e2e-clinic-fixture.ts', ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })
}

test.describe('clinic detail map dialog', () => {
  test.describe.configure({ mode: 'serial' })

  const slugPrefix = `e2e-clinic-map-${Date.now()}`
  let clinicSlug = ''

  test.beforeAll(async () => {
    const output = runFixtureCommand(['create', '--prefix', slugPrefix])
    const lines = output.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)

    if (!lastLine) {
      throw new Error('Fixture creation did not return a clinic slug.')
    }

    clinicSlug = (JSON.parse(lastLine) as { slug?: string }).slug ?? ''

    if (!clinicSlug) {
      throw new Error('Fixture creation returned an empty clinic slug.')
    }
  })

  test.afterAll(async () => {
    runFixtureCommand(['cleanup', '--prefix', slugPrefix])
  })

  test('opens the expanded map as an accessible dialog and restores focus on close @smoke', async ({
    page,
    context,
  }) => {
    const issues = createBrowserIssueCollector(page)

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Clinic Location' })).toBeVisible()

    const expandMapButton = page.getByRole('button', { name: 'Expand map' })
    await expandMapButton.click()

    await expect(page.getByRole('dialog', { name: 'Expanded Map View' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Expanded Map View' })).not.toBeVisible()
    await expect(expandMapButton).toBeFocused()
    await expectNoBrowserIssues(issues)
  })

  test('hides OpenStreetMap controls when functional consent is rejected @smoke', async ({ page, context }) => {
    const issues = createBrowserIssueCollector(page)

    await context.clearCookies()
    await setCookieConsent(context)

    await page.goto(`/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('OpenStreetMap is hidden until optional cookies are accepted.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Expand map' })).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).not.toBeVisible()
    await expectNoBrowserIssues(issues)
  })
})
