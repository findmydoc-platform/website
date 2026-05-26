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
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    await expect(page.getByRole('heading', { name: 'Clinic Location' })).toBeVisible()

    const previewMap = page.getByTitle(/Map preview of/)
    await expect(previewMap).toBeVisible()
    await expect(previewMap).not.toHaveClass(/pointer-events-none/)
    await expect(previewMap).toHaveAttribute('tabindex', '0')
    await expect(page.getByTestId('map-preview-interaction-guard')).toBeAttached()
    await expect(page.getByTestId('map-preview-interaction-guard-top')).toHaveClass(/right-\[72px\]/)
    await expect(page.getByTestId('map-preview-interaction-guard-body')).toHaveClass(/top-\[120px\]/)

    await previewMap.scrollIntoViewIfNeeded()
    const previewMapBox = await previewMap.boundingBox()
    expect(previewMapBox).not.toBeNull()
    if (previewMapBox) {
      const previewZoomPoint = {
        x: previewMapBox.x + previewMapBox.width - 24,
        y: previewMapBox.y + 24,
      }

      await expect
        .poll(
          async () =>
            page.evaluate(({ x, y }) => {
              const element = document.elementFromPoint(x, y)

              return {
                tagName: element?.tagName,
                title: element?.getAttribute('title'),
              }
            }, previewZoomPoint),
          { message: 'preview zoom hit target should remain inside the iframe' },
        )
        .toEqual(
          expect.objectContaining({
            tagName: 'IFRAME',
          }),
        )

      await page.mouse.click(previewZoomPoint.x, previewZoomPoint.y)
    }

    const expandMapButton = page.getByRole('button', { name: 'Expand map' })
    await expandMapButton.click()

    const dialog = page.getByRole('dialog', { name: 'Expanded Map View' })
    const interactiveMap = dialog.getByTitle(/Interactive map of/)

    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'View map in OpenStreetMap' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible()
    await expect(interactiveMap).toBeVisible()
    await expect(interactiveMap).not.toHaveClass(/pointer-events-none/)
    await expect(interactiveMap).toHaveAttribute('tabindex', '-1')
    await expect(dialog.getByRole('group', { name: 'Expanded map keyboard controls' })).not.toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Pan map north' })).not.toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Zoom map in' })).not.toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Reset map view' })).not.toBeVisible()
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

  test('submits the clinic contact form and persists an inquiry @smoke', async ({ page, context }) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })
    const email = `${slugPrefix}-contact@example.com`

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await page.locator('select[name="doctor"]').selectOption({ index: 1 })
    await page.getByLabel('Full Name').fill(`${slugPrefix} Patient`)
    await page.getByLabel('Phone Number').fill('+49 30 123456')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('How Soon Are You Considering Treatment?').selectOption('within_two_weeks')
    await page.getByLabel('When Should We Contact You?').selectOption('morning')
    await page.getByLabel('Message').fill('Please contact me about this clinic.')
    await page.getByLabel(/I agree that findmydoc may process/i).check()

    await page.getByRole('button', { name: 'Submit Contact Request' }).click()

    await expect(page.getByRole('status')).toHaveText('Your clinic request has been sent successfully.')
    await expect(page.getByRole('button', { name: 'Request sent' })).toBeDisabled()

    const output = runFixtureCommand(['read-inquiry', '--prefix', slugPrefix, '--email', email])
    const lines = output.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)

    if (!lastLine) {
      throw new Error('Inquiry lookup did not return output.')
    }

    expect(JSON.parse(lastLine)).toMatchObject({
      found: true,
      status: 'submitted',
      email,
      count: 1,
    })

    await expectNoBrowserIssues(issues)
  })
})
