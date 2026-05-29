import { expect, test, type Page, type Route } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'

const patientTestPassword = 'PatientPass123' // pragma: allowlist secret
const mismatchedPatientTestPassword = 'MismatchPass123' // pragma: allowlist secret

const supabaseCorsHeaders = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}

async function fulfillJson(route: Route, status: number, body: unknown, headers?: Record<string, string>) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers,
    body: JSON.stringify(body),
  })
}

async function stubSupabaseSignup(page: Page, handler: (route: Route) => Promise<void>) {
  await page.route('**/auth/v1/signup**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: supabaseCorsHeaders,
      })
      return
    }

    await handler(route)
  })
}

async function fillClinicRegistrationFunnel(page: Page) {
  await expect(page.locator('[data-clinic-registration-funnel-ready="true"]')).toBeVisible()
  await page.getByLabel('Klinikname').fill('Aurora Clinic')
  await page.getByLabel('Website').fill('https://aurora-clinic.example')
  await page.getByRole('button', { name: 'Weiter' }).click()

  await expect(page.getByRole('heading', { name: 'Schwerpunkte wählen' })).toBeVisible()
  const hairRestorationCategory = page.getByRole('button', { name: 'Hair Restoration' })
  if ((await hairRestorationCategory.getAttribute('aria-pressed')) !== 'true') {
    await hairRestorationCategory.click()
  }
  await page.getByRole('button', { name: 'Weiter' }).click()

  await expect(page.getByRole('heading', { name: 'Ihr Kontakt' })).toBeVisible()
  await page.getByLabel('Vollständiger Name').fill('Ada Lovelace')
  await page.getByLabel('E-Mail Adresse').fill('clinic@example.com')
  await page.getByLabel('Position / Funktion').selectOption({ label: 'Klinikmanagement' })
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

  await page.route('**/api/auth/register/clinic', async (route) => {
    clinicApiRequestCount += 1
    await route.abort()
  })

  await page.goto('/register/clinic', { waitUntil: 'domcontentloaded' })
  await fillClinicRegistrationFunnel(page)
  await page.getByRole('button', { name: 'Anfrage senden' }).click()

  await expect(page.getByRole('heading', { name: 'Anfrage übermittelt' })).toBeVisible()
  await expect(page.getByText('Ihre Anfrage wurde übermittelt.')).toBeVisible()
  await expect(page.getByText('Aurora Clinic')).toBeVisible()
  await expect(page.getByText('clinic@example.com')).toBeVisible()
  await expect(page.getByText('Hair Restoration')).toBeVisible()
  expect(clinicApiRequestCount).toBe(0)
  await expect(page).toHaveURL(/\/register\/clinic(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})

test('clinic registration surfaces inline validation errors before fake submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.goto('/register/clinic', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-clinic-registration-funnel-ready="true"]')).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()

  await expect(page.getByText('Bitte geben Sie den Kliniknamen ein.')).toBeVisible()
  await expect(page.getByText('Bitte geben Sie die Website ein.')).toBeVisible()
  await expect(page.getByLabel('Klinikname')).toBeFocused()

  await page.getByLabel('Klinikname').fill('Aurora Clinic')
  await page.getByLabel('Website').fill('https://aurora-clinic.example')
  await page.getByRole('button', { name: 'Weiter' }).click()

  await page.getByRole('button', { name: 'Dental' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByText('Bitte wählen Sie mindestens einen Schwerpunkt aus.')).toBeVisible()

  await page.getByRole('button', { name: 'Dental' }).click()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await page.getByRole('button', { name: 'Anfrage senden' }).click()

  await expect(page.getByText('Bitte geben Sie den vollständigen Namen ein.')).toBeVisible()
  await expect(page.getByText('Bitte geben Sie die E-Mail-Adresse ein.')).toBeVisible()
  await expect(page.getByText('Bitte wählen Sie eine Position aus.')).toBeVisible()
  await expect(page).toHaveURL(/\/register\/clinic(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})

test('patient registration redirects to the login page after a successful submit @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  let signupRequestCount = 0
  let metadataBody: Record<string, unknown> | null = null

  await stubSupabaseSignup(page, async (route) => {
    signupRequestCount += 1
    await fulfillJson(
      route,
      200,
      {
        user: {
          id: 'e2e-patient-user',
          email: 'patient@example.com',
        },
        session: null,
      },
      supabaseCorsHeaders,
    )
  })

  await page.route('**/api/auth/register/patient/metadata', async (route) => {
    metadataBody = route.request().postDataJSON() as Record<string, unknown>
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
  expect(signupRequestCount).toBe(1)
  expect(metadataBody).toMatchObject({
    email: 'patient@example.com',
    userId: 'e2e-patient-user',
  })
  await expectNoBrowserIssues(issues)
})

test('patient registration blocks mismatched passwords before any network request @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  let signupRequestCount = 0
  let metadataRequestCount = 0

  await stubSupabaseSignup(page, async (route) => {
    signupRequestCount += 1
    await route.abort()
  })

  await page.route('**/api/auth/register/patient/metadata', async (route) => {
    metadataRequestCount += 1
    await route.abort()
  })

  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  await fillPatientRegistrationForm(page, {
    password: patientTestPassword, // pragma: allowlist secret
    confirmPassword: mismatchedPatientTestPassword, // pragma: allowlist secret
  })
  await page.getByRole('button', { name: 'Create Patient Account' }).click()

  await expect(page.getByText('Passwords do not match')).toBeVisible()
  expect(signupRequestCount).toBe(0)
  expect(metadataRequestCount).toBe(0)
  await expect(page).toHaveURL(/\/register\/patient(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})

test('patient registration rolls back the partial signup when metadata provisioning fails @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/Failed to load resource: the server responded with a status of 500/],
  })
  let metadataRequestCount = 0
  let cleanupBody: Record<string, unknown> | null = null

  await stubSupabaseSignup(page, async (route) => {
    await fulfillJson(
      route,
      200,
      {
        user: {
          id: 'e2e-patient-user-rollback',
          email: 'patient@example.com',
        },
        session: null,
      },
      supabaseCorsHeaders,
    )
  })

  await page.route('**/api/auth/register/patient/metadata', async (route) => {
    metadataRequestCount += 1
    await route.fulfill({
      status: 500,
      contentType: 'text/plain',
      body: 'metadata failed',
    })
  })

  await page.route('**/api/auth/register/patient/cleanup', async (route) => {
    cleanupBody = route.request().postDataJSON() as Record<string, unknown>
    await fulfillJson(route, 200, { success: true })
  })

  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  await fillPatientRegistrationForm(page, { password: patientTestPassword }) // pragma: allowlist secret
  await page.getByRole('button', { name: 'Create Patient Account' }).click()

  await expect(
    page.getByText('We could not finish setting up your account. Please try again in a few minutes.'),
  ).toBeVisible()
  expect(metadataRequestCount).toBe(1)
  expect(cleanupBody).toMatchObject({
    email: 'patient@example.com',
    userId: 'e2e-patient-user-rollback',
  })
  await expect(page).toHaveURL(/\/register\/patient(?:\?.*)?$/)
  await expectNoBrowserIssues(issues)
})
