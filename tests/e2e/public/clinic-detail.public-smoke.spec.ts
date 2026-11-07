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

type InquiryLookup = {
  found: boolean
  clinic?: number | string | null
  doctor?: number | string | null
  treatment?: number | string | null
  status?: string
  email?: string
  createdAt?: string
  count: number
  totalClinicCount: number
}

function readInquiry(prefix: string, email: string): InquiryLookup {
  const output = runFixtureCommand(['read-inquiry', '--prefix', prefix, '--email', email])
  const lines = output.trim().split('\n').filter(Boolean)
  const lastLine = lines.at(-1)

  if (!lastLine) {
    throw new Error('Inquiry lookup did not return output.')
  }

  return JSON.parse(lastLine) as InquiryLookup
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
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(breadcrumb.getByRole('link', { name: 'Clinics' })).toBeVisible()
    await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Clinic Location' })).toBeVisible()

    const previewMap = page.getByTitle(/Map preview of/)
    await expect(previewMap).toBeVisible()
    await expect(previewMap).toHaveAttribute('tabindex', '0')

    const expandMapButton = page.getByRole('button', { name: 'Expand map' })
    await expandMapButton.click()

    const dialog = page.getByRole('dialog', { name: 'Expanded Map View' })
    const interactiveMap = dialog.getByTitle(/Interactive map of/)

    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'View map in OpenStreetMap' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible()
    await expect(interactiveMap).toBeVisible()
    await expect(interactiveMap).toHaveAttribute('tabindex', '-1')
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

  test('saves authorized clinic inquiries without delivering them before account completion @smoke', async ({
    page,
    context,
  }) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })
    const email = `${slugPrefix}-contact@example.com`
    const secondEmail = `${slugPrefix}-contact-second@example.com`

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const [selectedDoctorId] = await page.locator('select[name="doctor"]').selectOption({ index: 1 })
    expect(selectedDoctorId).toBeTruthy()
    await page.getByLabel('First Name').fill(slugPrefix)
    await page.getByLabel('Last Name').fill('Patient')
    await page.getByLabel('Phone Number').fill('+49 30 123456')
    await page.getByLabel('Email').fill(email)
    await page.getByLabel('How Soon Are You Considering Treatment?').selectOption('within_two_weeks')
    await page.getByLabel('When Should We Contact You?').selectOption('morning')
    await page.getByLabel('Message').fill('Please contact me about this clinic.')
    await page.getByLabel(/I agree that findmydoc may process/i).check()

    await page.getByRole('checkbox', { name: /authorize creation/i }).check()
    await page.getByRole('button', { name: 'Save inquiry and create account' }).click()

    await expect(page.getByRole('status')).toContainText('Your inquiry is saved but not sent.')
    await expect(page.getByRole('button', { name: 'Inquiry saved, not sent' })).toBeDisabled()

    expect(readInquiry(slugPrefix, email)).toMatchObject({ found: false, count: 0, totalClinicCount: 0 })

    await page.locator('form[aria-label="Clinic appointment request"]').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
    })

    await expect.poll(() => readInquiry(slugPrefix, email).count).toBe(0)
    expect(readInquiry(slugPrefix, email).totalClinicCount).toBe(0)

    await page.getByLabel('Email').fill(secondEmail)
    await expect(page.getByRole('button', { name: 'Save inquiry and create account' })).toBeEnabled()
    await page.getByRole('checkbox', { name: /authorize creation/i }).check()
    await page.getByRole('button', { name: 'Save inquiry and create account' }).click()

    await expect(page.getByRole('status')).toContainText('Your inquiry is saved but not sent.')
    await expect(page.getByRole('button', { name: 'Inquiry saved, not sent' })).toBeDisabled()

    expect(readInquiry(slugPrefix, secondEmail)).toMatchObject({ found: false, count: 0, totalClinicCount: 0 })

    await expectNoBrowserIssues(issues)
  })
})
