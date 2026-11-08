import { expect, test, type Page } from '@playwright/test'
import { setTimeout as delay } from 'node:timers/promises'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
type Clinic = { id: number; slug: string; name: string; doctorId: number | string }

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/inquiry-preparation-multiple'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 3 })
const { fixtureCommand, confirmationLinks, providerRequests } = runtime

async function fillPreparation(page: Page, clinic: Clinic, email: string, message: string) {
  await page.goto(`/clinics/${clinic.slug}`)
  const form = page.getByRole('form', { name: 'Clinic appointment request' })
  await form.getByRole('textbox', { name: 'First Name' }).fill('Synthetic')
  await form.getByRole('textbox', { name: 'Last Name' }).fill('Patient')
  await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000081')
  await form.getByRole('textbox', { name: 'Email' }).fill(email)
  await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
  await form.getByRole('textbox', { name: 'Message' }).fill(message)
  await form.getByRole('checkbox', { name: /process my contact details/ }).check()
  return form
}

test('retains both first inquiries saved concurrently from separate tabs', async ({ page, context }) => {
  const [clinic, clinicB] = runtime.clinics as [Clinic, Clinic]
  const other = await context.newPage()
  const issues = [createBrowserIssueCollector(page), createBrowserIssueCollector(other)]
  const email = 'parallel-first-browser@example.test'
  await setCookieConsent(context)
  const forms = await Promise.all([
    fillPreparation(page, clinic, email, 'Synthetic first-tab inquiry.'),
    fillPreparation(other, clinicB, email, 'Synthetic second-tab inquiry.'),
  ])
  for (const form of forms) await form.getByRole('checkbox', { name: /authorize creation/ }).check()
  let reached!: () => void
  let release!: () => void
  let secondReached!: () => void
  const firstRequest = new Promise<void>((resolve) => {
    reached = resolve
  })
  const firstReleased = new Promise<void>((resolve) => {
    release = resolve
  })
  const secondRequest = new Promise<void>((resolve) => {
    secondReached = resolve
  })
  let requests = 0
  await context.route('**/api/patient/inquiry-preparations', async (route) => {
    // Keep the cookies from request admission while controlling only transport timing.
    const headers = await route.request().allHeaders()
    if (++requests === 1) {
      reached()
      await firstReleased
    } else secondReached()
    const response = await route.fetch({ headers: { ...headers, cookie: headers.cookie ?? '' } })
    await route.fulfill({ response })
  })
  await forms[0]!.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await firstRequest
  try {
    await forms[1]!.getByRole('button', { name: 'Save inquiry and create account' }).click()
    await Promise.race([secondRequest, delay(1500)])
  } finally {
    release()
  }
  for (const form of forms) await expect(form.getByRole('status')).toContainText('saved but not sent')
  await context.unroute('**/api/patient/inquiry-preparations')
  for (const [index, tab] of [page, other].entries()) {
    await tab.setViewportSize({ width: 375, height: 812 })
    await tab.getByRole('link', { name: 'Continue account creation' }).click()
    await expect(tab).toHaveURL(/\/register\/patient\?inquiry=/)
    await tab.reload()
    await expect(tab.getByText(/Your inquiry is saved but not sent\./)).toBeVisible()
    await expect(tab.getByPlaceholder('patient@example.com')).toHaveValue(email)
    await expect(tab.getByLabel('First Name', { exact: true })).toHaveValue('Synthetic')
    await tab.screenshot({ path: `${artifacts}/parallel-first-${index + 1}-375.png`, fullPage: true })
  }
  for (const collector of issues) await expectNoBrowserIssues(collector)
})

test('keeps the form available without sending when safe browser coordination is unavailable', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined }))
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page)
  const form = await fillPreparation(
    page,
    runtime.clinics[0]!,
    'unsupported-browser@example.test',
    'Synthetic unsaved inquiry.',
  )
  await form.getByRole('checkbox', { name: /authorize creation/ }).check()
  let requests = 0
  context.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/patient/inquiry-preparations') requests++
  })
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  const error = form.getByRole('alert')
  await expect(error).toContainText('This browser cannot save your inquiry safely. Please use an updated browser.')
  expect(requests).toBe(0)
  await expect(form.getByRole('textbox', { name: 'Message' })).toHaveValue('Synthetic unsaved inquiry.')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
    await error.scrollIntoViewIfNeeded()
    await expect(error).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${artifacts}/unsupported-browser-${width}.png`, fullPage: true })
    if (width === 375) await form.screenshot({ path: `${artifacts}/unsupported-browser-form-375.png` })
  }
  await page.setViewportSize({ width: 375, height: 400 })
  await error.scrollIntoViewIfNeeded()
  await expect(error).toBeVisible()
  await expectNoBrowserIssues(issues)
})

test('keeps multiple clinic outcomes separate and retries only the selected failure with a keyboard', async ({
  page,
  browser,
  context,
}) => {
  const [clinic, clinicB, clinicC] = runtime.clinics as [Clinic, Clinic, Clinic]
  const issues = createBrowserIssueCollector(page)
  await setCookieConsent(context)
  await page.setViewportSize({ width: 375, height: 812 })
  const email = 'multiple-browser@example.test'
  async function prepare(destination: typeof clinic, message: string) {
    const form = await fillPreparation(page, destination, email, message)
    await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
    await expect(form.getByText('Authorize account creation and this inquiry submission.')).toBeVisible()
    await form.getByRole('checkbox', { name: /authorize creation/ }).focus()
    await page.keyboard.press('Space')
    await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
    await expect(form.getByRole('status')).toContainText('saved but not sent')
    await expect(form.getByRole('status')).toContainText('seven days')
  }
  await prepare(clinic, 'Synthetic separately authorized inquiry for clinic A.')
  await prepare(clinicB, 'Synthetic separately authorized inquiry for clinic B.')
  await prepare(clinicC, 'Synthetic separately authorized inquiry for clinic C.')
  await page.getByRole('link', { name: 'Continue account creation' }).click()
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  await page.getByLabel('Confirm Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  await page.getByRole('button', { name: 'Create Patient Account' }).click()
  await expect(page).toHaveURL(/patient-check-email/)
  await fixtureCommand('worker')
  const link = confirmationLinks.get(email)
  expect(link, JSON.stringify(providerRequests)).toBeTruthy()
  await fixtureCommand('pending', clinicB.id)
  await fixtureCommand('pending', clinicC.id)
  const otherDevice = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 } })
  try {
    await setCookieConsent(otherDevice)
    const other = await otherDevice.newPage()
    const otherIssues = createBrowserIssueCollector(other, {
      ignoredConsoleErrors: [/Failed to load resource.*40[034]/],
    })
    await other.goto(link!)
    await other.getByRole('button', { name: 'Confirm email', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    const notices = other.getByRole('region', { name: 'Inquiry submissions' })
    const noticeB = notices.getByRole('listitem').filter({ hasText: clinicB.name })
    const noticeC = notices.getByRole('listitem').filter({ hasText: clinicC.name })
    await expect(notices.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(2)
    await expect(other.getByText(clinic.name, { exact: true }).first()).toBeVisible()
    await noticeB.getByRole('button', { name: 'Try again', exact: true }).focus()
    await other.keyboard.press('Enter')
    await expect(noticeB.getByRole('alert')).toContainText('Please try sending')
    await expect(noticeC.getByRole('alert')).toHaveCount(0)
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: width < 640 ? 812 : 900 })
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await noticeC.getByRole('button', { name: 'Try again', exact: true }).scrollIntoViewIfNeeded()
      await expect(noticeC.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
      await other.screenshot({ path: `${artifacts}/mixed-${width}.png`, fullPage: true })
    }
    await other.setViewportSize({ width: 375, height: 400 })
    await noticeB.getByRole('button', { name: 'Try again', exact: true }).scrollIntoViewIfNeeded()
    await expect(noticeB.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await other.screenshot({ path: `${artifacts}/mixed-short-height.png`, fullPage: true })
    await fixtureCommand('approved', clinicB.id)
    await noticeB.getByRole('button', { name: 'Try again', exact: true }).focus()
    await other.keyboard.press('Enter')
    await expect(
      other.getByRole('status').filter({ hasText: `Your inquiry to ${clinicB.name} has been sent.` }),
    ).toHaveText(`Your inquiry to ${clinicB.name} has been sent.`)
    await expect(noticeB.getByRole('button')).toHaveCount(0)
    await expect(noticeC.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await expect(other.getByText(clinicB.name, { exact: true }).first()).toBeVisible()
    await other.reload()
    await expect(notices.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(1)
    await other.setViewportSize({ width: 1024, height: 900 })
    await other.screenshot({ path: `${artifacts}/independent-retry-desktop.png`, fullPage: true })
    for (const destination of [clinic, clinicB])
      expect(((await fixtureCommand('count', destination.id)) as { totalDocs: number }).totalDocs).toBe(1)
    expect(((await fixtureCommand('count', clinicC.id)) as { totalDocs: number }).totalDocs).toBe(0)
    await expectNoBrowserIssues(otherIssues)
  } finally {
    await otherDevice.close()
  }
  await expectNoBrowserIssues(issues)
})
