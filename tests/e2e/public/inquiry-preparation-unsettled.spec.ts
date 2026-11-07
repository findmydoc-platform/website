import { expect, test } from '@playwright/test'
import type { PreparationReceipt } from '../../../src/features/inquiryPreparations/contracts'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/inquiry-preparation-unsettled'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 3 })

for (const retry of [true, false]) {
  test(`keeps a lost ${retry ? 'manual retry' : 'first attempt'} unresolved across reload before admission`, async ({
    browser,
  }) => {
    runtime.resetIdentities()
    const clinic = runtime.clinics[retry ? 0 : 1]!
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 640 } })
    await setCookieConsent(context)
    const email = `unsettled-browser-${retry}@example.test`
    const saved = await context.request.post('/api/patient/inquiry-preparations', {
      headers: { Origin: origin },
      data: {
        clinicId: String(clinic.id),
        doctorId: String(clinic.doctorId),
        idempotencyKey: `unsettled-browser-${retry}`,
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
    if (retry) await runtime.fixtureCommand('pending', clinic.id)
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
    let previousAttemptKey: string | undefined
    if (retry) {
      await page.goto(runtime.confirmationLinks.get(email)!)
      await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
      await expect(page).toHaveURL(/\/patient\/inquiries$/)
      await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
      await runtime.fixtureCommand('approved', clinic.id)
      await expect.poll(() => lastReceipt?.status).toBe('try-again')
      await expect.poll(() => initialListRead).toBe(true)
      previousAttemptKey = lastReceipt!.attemptKey
      expect(previousAttemptKey).toEqual(expect.any(String))
    }
    let paused!: ReturnType<typeof runtime.pauseNextIdentityRead>
    let signalPauseReady!: () => void
    const pauseReady = new Promise<void>((resolve) => {
      signalPauseReady = resolve
    })
    let original!: Promise<import('@playwright/test').APIResponse>
    let requestedAttemptKey: string | undefined
    let originalCompleted = false
    let posts = 0
    page.on('request', (request) => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/patient/inquiry-preparations/submit')
        posts++
    })
    await page.route(
      '**/api/patient/inquiry-preparations/submit',
      async (route) => {
        // Finish the initial page reads before pausing only the POST's external identity verification.
        await expect.poll(() => initialListRead && Boolean(lastReceipt)).toBe(true)
        lastReceipt = undefined
        paused = runtime.pauseNextIdentityRead()
        signalPauseReady()
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
      if (retry) await page.getByRole('button', { name: 'Try again', exact: true }).click()
      else {
        await page.goto(runtime.confirmationLinks.get(email)!)
        await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
        await expect(page).toHaveURL(/\/patient\/inquiries$/)
      }
      await pauseReady
      await paused.reached
      await expect.poll(() => lastReceipt?.status).toBe(retry ? 'try-again' : 'saved-not-sent')
      expect(lastReceipt?.attemptKey).toBe(previousAttemptKey)
      expect(requestedAttemptKey).toEqual(expect.any(String))
      expect(requestedAttemptKey).not.toBe(previousAttemptKey)
      expect(originalCompleted).toBe(false)
      const notices = page.getByRole('region', { name: 'Inquiry submissions' })
      await expect(notices).toContainText('Delivery not confirmed')
      await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled()
      await expect(notices).not.toContainText('saved but not sent')
      await expect(notices).not.toContainText('was not sent')
      await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
      await page.addInitScript(() => {
        Object.assign(window, { inquiryReloadExposedUnsafeState: false })
        new MutationObserver(() => {
          const text = document.querySelector<HTMLElement>('[aria-label="Inquiry submissions"]')?.innerText || ''
          if (/saved but not sent|was not sent|Not sent|Try again/.test(text))
            Reflect.set(window, 'inquiryReloadExposedUnsafeState', true)
        }).observe(document, { childList: true, subtree: true, characterData: true })
      })
      await page.reload()
      await expect(notices).toContainText('Delivery not confirmed')
      await expect(notices).not.toContainText('saved but not sent')
      await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
      expect(originalCompleted).toBe(false)
      expect(posts).toBe(1)
      expect(await page.evaluate(() => Reflect.get(window, 'inquiryReloadExposedUnsafeState'))).toBe(false)
      // This read succeeds with the previous settled attempt; it cannot settle the new paused POST.
      await page.getByRole('button', { name: 'Check status', exact: true }).focus()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('button', { name: 'Check status', exact: true })).toBeEnabled()
      await expect(notices).toContainText('Delivery not confirmed')
      await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
      expect(((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(0)
      expect(posts).toBe(1)
      await page.screenshot({
        path: `${artifacts}/${retry ? 'previous-attempt' : 'first-attempt'}-reload-unresolved-375.png`,
        fullPage: true,
      })
    } finally {
      paused?.release()
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
}

test('does not send when the browser cannot retain reload correlation', async ({ browser }) => {
  runtime.resetIdentities()
  const clinic = runtime.clinics[2]!
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 640 } })
  await setCookieConsent(context)
  const email = 'storage-unavailable@example.test'
  const prepared = await context.request.post('/api/patient/inquiry-preparations', {
    headers: { Origin: origin },
    data: {
      clinicId: String(clinic.id),
      doctorId: String(clinic.doctorId),
      idempotencyKey: 'storage-unavailable',
      firstName: 'Storage',
      lastName: 'Patient',
      email,
      phoneNumber: '+493000000080',
      message: 'Synthetic storage failure inquiry.',
      consent: true,
      accountAuthorization: true,
    },
  })
  expect(prepared.status()).toBe(201)
  expect(
    (
      await context.request.post('/api/auth/register/patient', {
        headers: { Origin: origin },
        data: { email, password: 'SyntheticPatient123', firstName: 'Storage', lastName: 'Patient' }, // pragma: allowlist secret
      })
    ).status(),
  ).toBe(200)
  await runtime.fixtureCommand('worker')
  await context.addInitScript(() => {
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (this === window.sessionStorage) throw new DOMException('Session storage is unavailable.', 'SecurityError')
      setItem.call(this, key, value)
    }
  })
  const page = await context.newPage()
  const issues = createBrowserIssueCollector(page, { ignoredConsoleErrors: [/Failed to load resource.*40[034]/] })
  let posts = 0
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/patient/inquiry-preparations/submit')
      posts++
  })
  await page.goto(runtime.confirmationLinks.get(email)!)
  await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
  await expect(page).toHaveURL(/\/patient\/inquiries$/)
  await expect(page.getByRole('region', { name: 'Inquiry submissions' }).getByRole('alert')).toContainText(
    'browser could not retain the submission status',
  )
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
  expect(posts).toBe(0)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Inquiry submissions' }).getByRole('alert')).toContainText(
    'browser could not retain the submission status',
  )
  expect(posts).toBe(0)
  await page.screenshot({ path: `${artifacts}/storage-unavailable-375.png`, fullPage: true })
  expect(((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(0)
  await expectNoBrowserIssues(issues)
  await context.close()
})

test('quietly resolves a lost response with automatic status reads and one submission', async ({ browser }) => {
  runtime.resetIdentities()
  const clinic = runtime.clinics[0]!
  const before = ((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs
  const context = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 640 } })
  await setCookieConsent(context)
  const email = 'automatic-status@example.test'
  expect(
    (
      await context.request.post('/api/patient/inquiry-preparations', {
        headers: { Origin: origin },
        data: {
          clinicId: String(clinic.id),
          doctorId: String(clinic.doctorId),
          idempotencyKey: 'automatic-status',
          firstName: 'Automatic',
          lastName: 'Patient',
          email,
          phoneNumber: '+493000000080',
          message: 'Synthetic automatic status inquiry.',
          consent: true,
          accountAuthorization: true,
        },
      })
    ).status(),
  ).toBe(201)
  expect(
    (
      await context.request.post('/api/auth/register/patient', {
        headers: { Origin: origin },
        data: { email, password: 'SyntheticPatient123', firstName: 'Automatic', lastName: 'Patient' }, // pragma: allowlist secret
      })
    ).status(),
  ).toBe(200)
  await runtime.fixtureCommand('worker')
  const page = await context.newPage()
  let lostResponse = false
  let statusReads = 0
  let submissions = 0
  await page.route('**/api/patient/inquiry-preparations', async (route) => {
    if (lostResponse && ++statusReads <= 2) await route.abort('failed')
    else await route.continue()
  })
  await page.route('**/api/patient/inquiry-preparations/submit', async (route) => {
    submissions++
    const result = await route.fetch()
    expect(result.status()).toBe(200)
    lostResponse = true
    await route.abort('failed')
  })
  await page.goto(runtime.confirmationLinks.get(email)!)
  await page.getByRole('button', { name: 'Confirm email', exact: true }).click()
  const list = page.getByRole('region', { name: 'Patient inquiry list' })
  await expect(list.getByRole('link').filter({ hasText: clinic.name }).first()).toBeVisible()
  await expect.poll(() => statusReads, { timeout: 10_000 }).toBe(3)
  await expect(page.getByRole('button', { name: 'Check status', exact: true })).toHaveCount(0)
  await expect(page.getByText('Delivery not confirmed', { exact: true })).toHaveCount(0)
  expect(submissions).toBe(1)
  expect(((await runtime.fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(before + 1)
  await page.screenshot({ path: `${artifacts}/automatic-recovery-375.png`, fullPage: true })
  await context.close()
})
