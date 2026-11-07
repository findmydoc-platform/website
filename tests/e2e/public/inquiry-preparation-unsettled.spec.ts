import { expect, test } from '@playwright/test'
import type { PreparationReceipt } from '../../../src/features/inquiryPreparations/contracts'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/inquiry-preparation-unsettled'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts })

test('does not settle a lost manual retry from an earlier failed attempt while provider verification is pending', async ({
  browser,
}) => {
  const clinic = runtime.clinics[0]!
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 640 } })
  await setCookieConsent(context)
  const email = 'unsettled-browser@example.test'
  const saved = await context.request.post('/api/patient/inquiry-preparations', {
    headers: { Origin: origin },
    data: {
      clinicId: String(clinic.id),
      doctorId: String(clinic.doctorId),
      idempotencyKey: 'unsettled-browser',
      firstName: 'Unsettled',
      lastName: 'Patient',
      email,
      phoneNumber: '+493000000080',
      message: 'Synthetic unsettled inquiry.',
      consent: true,
      accountAuthorization: true,
    },
  })
  expect(saved.status()).toBe(201)
  const reference = ((await saved.json()) as PreparationReceipt).reference
  expect(
    (
      await context.request.post('/api/auth/register/patient', {
        headers: { Origin: origin },
        data: {
          email,
          password: 'SyntheticPatient123', // pragma: allowlist secret
          firstName: 'Unsettled',
          lastName: 'Patient',
        },
      })
    ).status(),
  ).toBe(200) // pragma: allowlist secret
  await runtime.fixtureCommand('worker')
  await runtime.fixtureCommand('pending', clinic.id)
  const page = await context.newPage()
  const issues = createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/Failed to load resource.*40[034]/, /net::ERR_FAILED/],
  })
  let lastReceipt: PreparationReceipt | undefined
  let initialListRead = false
  page.on('response', async (response) => {
    if (response.request().method() !== 'GET' || response.status() !== 200) return
    try {
      const path = new URL(response.url()).pathname
      if (path === '/api/patient/inquiry-preparations') {
        const body = (await response.json()) as { preparations: PreparationReceipt[] }
        lastReceipt = body.preparations.find((item) => item.reference === reference)
      } else if (path === '/api/patient/inquiries') {
        await response.json()
        initialListRead = true
      }
    } catch {
      // A controlled transport abort need not have a readable body.
    }
  })
  await page.goto(runtime.confirmationLinks.get(email)!)
  await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/inquiries$/)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await runtime.fixtureCommand('approved', clinic.id)
  await expect.poll(() => lastReceipt?.status).toBe('try-again')
  await expect.poll(() => initialListRead).toBe(true)
  const previousAttemptKey = lastReceipt!.attemptKey
  expect(previousAttemptKey).toEqual(expect.any(String))
  lastReceipt = undefined
  const paused = runtime.pauseNextIdentityRead()
  let original!: Promise<import('@playwright/test').APIResponse>
  let requestedAttemptKey: string | undefined
  let originalCompleted = false
  await page.route(
    '**/api/patient/inquiry-preparations/submit',
    async (route) => {
      requestedAttemptKey = (route.request().postDataJSON() as { attemptKey: string }).attemptKey
      original = route.fetch().then((response) => {
        originalCompleted = true
        return response
      })
      await paused.reached
      await route.abort('failed')
    },
    { times: 1 },
  )
  try {
    await page.getByRole('button', { name: 'Try again', exact: true }).click()
    await paused.reached
    await expect.poll(() => lastReceipt?.attemptKey).toBe(previousAttemptKey)
    expect(requestedAttemptKey).toEqual(expect.any(String))
    expect(requestedAttemptKey).not.toBe(previousAttemptKey)
    expect(originalCompleted).toBe(false)
    const notices = page.getByRole('region', { name: 'Unsent inquiries' })
    await expect(notices).toContainText('submission result is not yet known')
    await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled()
    await expect(notices).not.toContainText('saved but not sent')
    await expect(notices).not.toContainText('was not sent')
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
    // This read succeeds with the previous settled attempt; it cannot settle the new paused POST.
    await page.getByRole('button', { name: 'Check status', exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled()
    await expect(notices).toContainText('submission result is not yet known')
    await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
    expect(((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(0)
    await page.screenshot({ path: `${artifacts}/previous-attempt-is-not-settlement-375.png`, fullPage: true })
  } finally {
    paused.release()
    if (original) expect((await original).status()).toBe(200)
  }
  await page.getByRole('button', { name: 'Check status', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('status').filter({ hasText: `Your inquiry to ${clinic.name} has been sent.` }),
  ).toBeVisible()
  await page.reload()
  expect(((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(1)
  await expectNoBrowserIssues(issues)
  await context.close()
})
