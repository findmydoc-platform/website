import { execFileSync } from 'node:child_process'

import { expect, test, type Route } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

test.beforeEach(async ({ context }) => {
  await setCookieConsent(context)
})

const patientTestPassword = 'PatientPass123' // pragma: allowlist secret

async function fulfillJson(route: Route, status: number, body: unknown, headers?: Record<string, string>) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  })
}

function runClinicRegistrationFixtureCommand(args: string[]) {
  return execFileSync('pnpm', ['dlx', 'tsx', 'scripts/public-e2e-clinic-registration-fixture.ts', ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })
}

type ClinicApplicationLookup = {
  found: boolean
  clinicName?: string
  clinicWebsite?: string
  contactFirstName?: string
  contactLastName?: string
  contactEmail?: string
  contactRole?: string
  medicalSpecialties: Array<number | string>
  status?: string
  createdAt?: string
  privacyNotice?: {
    acknowledgedAt?: string
    url?: string
  }
  hasAdditionalNotes: boolean
  count: number
}

function readClinicApplication(prefix: string, email: string): ClinicApplicationLookup {
  const output = runClinicRegistrationFixtureCommand(['read-application', '--prefix', prefix, '--email', email])
  const lines = output.trim().split('\n').filter(Boolean)
  const lastLine = lines.at(-1)

  if (!lastLine) {
    throw new Error('Clinic application lookup did not return output.')
  }

  return JSON.parse(lastLine) as ClinicApplicationLookup
}

function expectValidIsoDate(value: string | undefined) {
  expect(value).toEqual(expect.any(String))
  expect(Number.isNaN(Date.parse(value ?? ''))).toBe(false)
}

const clinicRegistrationPrefixes = new Set<string>()

test.afterEach(() => {
  for (const prefix of [...clinicRegistrationPrefixes]) {
    runClinicRegistrationFixtureCommand(['cleanup', '--prefix', prefix])
    clinicRegistrationPrefixes.delete(prefix)
  }
})

test('clinic registration persists a real application after funnel submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const prefix = `e2e-clinic-registration-${Date.now()}`
  const clinicName = `${prefix} Clinic`
  const clinicWebsite = `https://${prefix}.example.com`
  const contactEmail = `${prefix}@example.com`

  clinicRegistrationPrefixes.add(prefix)

  await page.goto('/register/clinic', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-clinic-registration-funnel-ready="true"]')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Register your clinic' })).toBeVisible()

  await page.getByLabel('Clinic name').fill(clinicName)
  await page.getByLabel('Website').fill(clinicWebsite)
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Choose focus areas' })).toBeVisible()
  const dentalCategory = page.getByRole('button', { name: 'Dental' })
  if ((await dentalCategory.getAttribute('aria-pressed')) !== 'true') {
    await dentalCategory.click()
  }
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Your contact' })).toBeVisible()
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Email address').fill(contactEmail)
  await page.getByLabel('Position / role').selectOption({ label: 'Clinic Management' })
  await page.getByRole('button', { name: 'Submit request' }).click()

  await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible()
  await expect(page.getByText(clinicName)).toBeVisible()
  await expect(page.getByText(contactEmail)).toBeVisible()

  const application = readClinicApplication(prefix, contactEmail)
  expect(application).toMatchObject({
    found: true,
    clinicName,
    clinicWebsite: new URL(clinicWebsite).toString(),
    contactFirstName: 'Ada',
    contactLastName: 'Lovelace',
    contactEmail,
    contactRole: 'Clinic Management',
    status: 'submitted',
    count: 1,
    hasAdditionalNotes: false,
  })
  expect(application.medicalSpecialties.length).toBeGreaterThan(0)
  expectValidIsoDate(application.createdAt)
  expectValidIsoDate(application.privacyNotice?.acknowledgedAt)
  expect(application.privacyNotice?.url).toBe('/privacy-policy')
  await expectNoBrowserIssues(issues)
})

const patientRegistrationLocales = [
  {
    locale: 'de',
    prefix: '',
    otherLocale: 'en',
    submit: 'Patientenkonto erstellen',
    firstName: 'Vorname',
    lastName: 'Nachname',
    email: 'E-Mail',
    password: 'Passwort', // pragma: allowlist secret
    confirmation: 'Passwort bestätigen',
  },
  {
    locale: 'en',
    prefix: '/en',
    otherLocale: 'de',
    submit: 'Create Patient Account',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    password: 'Password', // pragma: allowlist secret
    confirmation: 'Confirm Password',
  },
] as const

for (const variant of patientRegistrationLocales) {
  test(`patient registration validates, retries and preserves the login destination in ${variant.locale} @smoke`, async ({
    baseURL,
    page,
  }) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 503 .*\/api\/auth\/register\/patient/,
      ],
    })
    const providerError = 'Synthetic provider detail for this test'
    const submissions: Array<{ method: string; body: unknown }> = []
    let finishFailure!: () => void
    const releaseFailure = new Promise<void>((resolve) => {
      finishFailure = resolve
    })

    await page.route('**/api/auth/register/patient', async (route) => {
      const request = route.request()
      submissions.push({ method: request.method(), body: request.postDataJSON() })
      if (submissions.length === 1) {
        await releaseFailure
        await fulfillJson(route, 503, { error: providerError })
      } else {
        await fulfillJson(route, 200, { success: true })
      }
    })

    await page.setExtraHTTPHeaders({
      'accept-language': variant.otherLocale,
      'x-findmydoc-ui-copy-locale': variant.otherLocale,
    })
    await page
      .context()
      .addCookies([{ name: 'NEXT_LOCALE', value: variant.otherLocale, url: new URL('/', baseURL).href }])

    const destination = `${variant.prefix}/register/patient?locale=${variant.otherLocale}&lang=${variant.otherLocale}`
    const response = await page.goto(destination, { waitUntil: 'domcontentloaded' })
    expect(response?.ok()).toBe(true)
    expect((await response?.text())?.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1]).toBe(variant.locale)
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale)
    await expect(page).toHaveURL(new URL(destination, baseURL).href)

    const form = page.getByRole('form', { name: variant.submit })
    const submit = form.getByRole('button', { name: variant.submit, exact: true })
    const firstName = form.getByLabel(variant.firstName, { exact: true })
    const confirmPassword = form.getByLabel(variant.confirmation, { exact: true })

    await submit.click()
    await expect(firstName).toBeFocused()
    await expect(firstName).toHaveAttribute('aria-invalid', 'true')
    await expect(firstName).toHaveAccessibleDescription(/\S/)
    await expect(form.getByRole('alert').first()).toBeVisible()

    for (const width of [320, 375, 640, 768, 1024]) {
      await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
      await expect(firstName).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({
        path: test.info().outputPath(`patient-registration-${variant.locale}-${width}.png`),
        fullPage: true,
      })
    }

    await firstName.fill('John')
    await expect(firstName).not.toHaveAttribute('aria-invalid', 'true')
    await form.getByLabel(variant.lastName, { exact: true }).fill('Doe')
    await form.getByLabel(variant.email, { exact: true }).fill('patient@example.com')
    await form.getByLabel(variant.password, { exact: true }).fill(patientTestPassword)
    await confirmPassword.fill('Mismatch123')
    await submit.click()
    await expect(confirmPassword).toBeFocused()
    await expect(confirmPassword).toHaveAttribute('aria-invalid', 'true')
    await expect(confirmPassword).toHaveAccessibleDescription(/\S/)
    expect(submissions).toHaveLength(0)

    await confirmPassword.fill(patientTestPassword)
    await expect(confirmPassword).not.toHaveAttribute('aria-invalid', 'true')
    try {
      await submit.click()
      await expect(form.getByRole('button')).toBeDisabled()
      await expect(form.getByRole('status')).toContainText(/\S/)
    } finally {
      finishFailure()
    }

    const failure = page.getByRole('alert').filter({ hasText: /\S/ })
    await expect(failure).toContainText(/\S/)
    await expect(failure).not.toContainText(providerError)
    await expect(page).toHaveURL(new URL(destination, baseURL).href)
    await expect(submit).toBeEnabled()
    await page.setViewportSize({ width: 375, height: 812 })
    await page.screenshot({
      path: test.info().outputPath(`patient-registration-${variant.locale}-retry.png`),
      fullPage: true,
    })
    await expect(firstName).toHaveValue('John')
    await submit.click()

    const loginDestination = `${variant.prefix}/login/patient?message=patient-check-email`
    await expect(page).toHaveURL(new URL(loginDestination, baseURL).href)
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale)
    await expect(page.getByRole('status').filter({ hasText: /\S/ })).toBeVisible()

    const submission = {
      method: 'POST',
      body: {
        email: 'patient@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: patientTestPassword,
      },
    }
    expect(submissions).toEqual([submission, submission])
    await expectNoBrowserIssues(issues)
  })
}

test('patient login follows the language in each public URL @smoke', async ({ baseURL, page }) => {
  const issues = createBrowserIssueCollector(page)
  const cookieUrl = new URL('/', baseURL).href
  const main = page.getByRole('main')
  const form = main.locator('form')
  const email = form.getByRole('textbox').and(form.locator('input[type="email"]'))

  for (const { locale, prefix, conflictingLocale } of [
    { locale: 'de', prefix: '', conflictingLocale: 'en' },
    { locale: 'en', prefix: '/en', conflictingLocale: 'de' },
  ]) {
    await page.setExtraHTTPHeaders({
      'accept-language': conflictingLocale,
      'x-findmydoc-ui-copy-locale': conflictingLocale,
    })
    await page.context().addCookies([{ name: 'NEXT_LOCALE', value: conflictingLocale, url: cookieUrl }])
    const destination = `${prefix}/login/patient?locale=${conflictingLocale}&lang=${conflictingLocale}`
    const response = await page.goto(destination, { waitUntil: 'domcontentloaded' })
    expect((await response?.text())?.match(/<html\b[^>]*\blang="([^"]+)"/)?.[1]).toBe(locale)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(page).toHaveURL(new URL(destination, baseURL).href)

    for (const width of [320, 375, 640, 768, 1024]) {
      await page.setViewportSize({ width, height: 800 })
      await expect(main.getByRole('heading', { level: 1 })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      await page.screenshot({ path: test.info().outputPath(`patient-login-${locale}-${width}.png`), fullPage: true })
    }

    for (const href of [`${prefix}/register/patient`, `${prefix}/auth/password/reset`]) {
      const link = main.getByRole('link').and(main.locator(`[href="${href}"]`))
      await expect(link).toBeVisible()
      await expect(link).toHaveAccessibleName(/\S/)
    }
    await form.getByRole('button').click()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(email).toHaveAccessibleDescription(/\S/)
  }

  const home = main.getByRole('link').and(main.locator('[href="/"]'))
  await page.goto('/login/patient', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await home.click()
  await expect(page).toHaveURL(new URL('/', baseURL).href)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expectNoBrowserIssues(issues)
})
