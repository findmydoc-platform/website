import { execFileSync } from 'node:child_process'

import { expect, test, type Page, type Route } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'

const patientTestPassword = 'PatientPass123' // pragma: allowlist secret
const mismatchedPatientTestPassword = 'MismatchPass123' // pragma: allowlist secret

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

async function fillClinicRegistrationFunnel(page: Page) {
  await expect(page.locator('[data-clinic-registration-funnel-ready="true"]')).toBeVisible()
  await page.getByLabel('Clinic name').fill('Aurora Clinic')
  await page.getByLabel('Website').fill('https://aurora-clinic.example')
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Choose focus areas' })).toBeVisible()
  const hairRestorationCategory = page.getByRole('button', { name: 'Hair Restoration' })
  if ((await hairRestorationCategory.getAttribute('aria-pressed')) !== 'true') {
    await hairRestorationCategory.click()
  }
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByRole('heading', { name: 'Your contact' })).toBeVisible()
  await page.getByLabel('First name').fill('Ada')
  await page.getByLabel('Last name').fill('Lovelace')
  await page.getByLabel('Email address').fill('clinic@example.com')
  await page.getByLabel('Position / role').selectOption({ label: 'Clinic Management' })
}

async function fillPatientRegistrationForm(page: Page, passwords: { password: string; confirmPassword?: string }) {
  await page.getByLabel('First Name').fill('John')
  await page.getByLabel('Last Name').fill('Doe')
  await page.getByLabel('Email').fill('patient@example.com')
  await page.getByLabel(/^Password$/).fill(passwords.password)
  await page.getByLabel(/^Confirm Password$/).fill(passwords.confirmPassword ?? passwords.password)
}

test('clinic registration shows success feedback after a successful submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  let clinicApiRequestCount = 0
  let clinicApiRequestBody: Record<string, unknown> | null = null

  await page.route('**/api/auth/register/clinic', async (route) => {
    clinicApiRequestCount += 1
    clinicApiRequestBody = route.request().postDataJSON() as Record<string, unknown>
    await fulfillJson(route, 200, { success: true, id: 123 })
  })

  await page.goto('/register/clinic', { waitUntil: 'domcontentloaded' })
  await fillClinicRegistrationFunnel(page)
  await page.getByRole('button', { name: 'Submit request' }).click()

  await expect(page.getByRole('heading', { name: 'Request submitted' })).toBeVisible()
  await expect(page.getByText('Your request has been submitted.')).toBeVisible()
  await expect(page.getByText('Aurora Clinic')).toBeVisible()
  await expect(page.getByText('clinic@example.com')).toBeVisible()
  await expect(page.getByText('Hair Restoration')).toBeVisible()
  expect(clinicApiRequestCount).toBe(1)
  expect(clinicApiRequestBody).not.toBeNull()
  const submittedClinicApplication = clinicApiRequestBody as unknown as Record<string, unknown>
  expect(submittedClinicApplication).toMatchObject({
    clinicName: 'Aurora Clinic',
    clinicWebsite: 'https://aurora-clinic.example',
    contactFirstName: 'Ada',
    contactLastName: 'Lovelace',
    contactEmail: 'clinic@example.com',
    contactRole: 'Clinic Management',
  })
  expect(submittedClinicApplication.medicalSpecialties).toEqual(expect.arrayContaining([expect.any(String)]))
  await expect(page).toHaveURL(/\/register\/clinic(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
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

test('clinic registration surfaces inline validation errors before submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/register/clinic', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-clinic-registration-funnel-ready="true"]')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()

  await expect(page.getByText('Please enter the clinic name.')).toBeVisible()
  await expect(page.getByText('Please enter the website.')).toBeVisible()
  await expect(page.getByLabel('Clinic name')).toBeFocused()

  await page.getByLabel('Clinic name').fill('Aurora Clinic')
  await page.getByLabel('Website').fill('https://aurora-clinic.example')
  await page.getByRole('button', { name: 'Continue' }).click()

  await page.getByRole('button', { name: 'Dental' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByText('Please select at least one focus area.')).toBeVisible()

  await page.getByRole('button', { name: 'Dental' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Submit request' }).click()

  await expect(page.getByText('Please enter the first name.')).toBeVisible()
  await expect(page.getByText('Please enter the last name.')).toBeVisible()
  await expect(page.getByText('Please enter the email address.')).toBeVisible()
  await expect(page.getByText('Please select a position.')).toBeVisible()
  await expect(page).toHaveURL(/\/register\/clinic(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})

test('patient registration redirects to the login page after a successful submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  let patientRegistrationRequestCount = 0
  let patientRegistrationBody: Record<string, unknown> | null = null

  await page.route('**/api/auth/register/patient', async (route) => {
    patientRegistrationRequestCount += 1
    patientRegistrationBody = route.request().postDataJSON() as Record<string, unknown>
    await fulfillJson(route, 200, { success: true })
  })

  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  await fillPatientRegistrationForm(page, { password: patientTestPassword }) // pragma: allowlist secret
  await page.getByRole('button', { name: 'Create Patient Account' }).click()

  await expect(page).toHaveURL(/\/login\/patient\?message=patient-check-email$/)
  await expect(
    page.getByText(
      'Check your email for the verification link we sent so you can finish setting up your findmydoc account.',
    ),
  ).toBeVisible()
  expect(patientRegistrationRequestCount).toBe(1)
  expect(patientRegistrationBody).toMatchObject({
    email: 'patient@example.com',
    firstName: 'John',
    lastName: 'Doe',
    password: expect.any(String),
  })
  await expectNoBrowserIssues(issues)
})

test('patient registration blocks mismatched passwords before any network request @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  let patientRegistrationRequestCount = 0

  await page.route('**/api/auth/register/patient', async (route) => {
    patientRegistrationRequestCount += 1
    await route.abort()
  })

  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  await fillPatientRegistrationForm(page, {
    password: patientTestPassword, // pragma: allowlist secret
    confirmPassword: mismatchedPatientTestPassword, // pragma: allowlist secret
  })
  await page.getByRole('button', { name: 'Create Patient Account' }).click()

  await expect(page.getByText('Passwords do not match')).toBeVisible()
  expect(patientRegistrationRequestCount).toBe(0)
  await expect(page).toHaveURL(/\/register\/patient(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})

test('patient registration surfaces server provisioning failures without cleanup @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/Failed to load resource: the server responded with a status of 500/],
  })
  let patientRegistrationRequestCount = 0

  await page.route('**/api/auth/register/patient', async (route) => {
    patientRegistrationRequestCount += 1
    await fulfillJson(route, 500, {
      error: 'We could not finish setting up your account. Please try again in a few minutes.',
    })
  })

  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  await fillPatientRegistrationForm(page, { password: patientTestPassword }) // pragma: allowlist secret
  await page.getByRole('button', { name: 'Create Patient Account' }).click()

  await expect(
    page.getByText('We could not finish setting up your account. Please try again in a few minutes.'),
  ).toBeVisible()
  expect(patientRegistrationRequestCount).toBe(1)
  await expect(page).toHaveURL(/\/register\/patient(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})
