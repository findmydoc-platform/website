import { expect, test } from '@playwright/test'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'

const origin = resolvePlaywrightBaseURL({ E2E_PORT: '3000', ...process.env })
const artifacts = 'output/playwright/inquiry-preparation'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 1 })
const { fixtureCommand, confirmationLinks, providerRequests } = runtime

test('prepares, registers, confirms on another device and deliberately retries through My inquiries', async ({
  page,
  browser,
  context,
}) => {
  const clinic = runtime.clinics[0]!
  const issues = createBrowserIssueCollector(page)
  await setCookieConsent(context)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/clinics/${clinic.slug}`)
  const form = page.getByRole('form', { name: 'Clinic appointment request' })
  await form.getByRole('textbox', { name: 'First Name' }).fill('Synthetic')
  await form.getByRole('textbox', { name: 'Last Name' }).fill('Patient')
  await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000090')
  await form.getByRole('textbox', { name: 'Email' }).fill('preparation-browser@example.test')
  await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
  await form.getByRole('textbox', { name: 'Message' }).fill('Synthetic inquiry for browser verification.')
  await form.getByRole('checkbox', { name: /process my contact details/ }).check()
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByText('Authorize account creation and this inquiry submission.')).toBeVisible()
  await form.getByRole('checkbox', { name: /authorize creation/ }).focus()
  await page.keyboard.press('Space')
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByRole('status')).toContainText('saved but not sent')
  await expect(form.getByRole('status')).toContainText('seven days')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await form.getByRole('status').screenshot({ path: `${artifacts}/saved-${width}.png` })
  }
  await form.getByRole('link', { name: 'Continue account creation' }).click()
  await expect(page).toHaveURL(/\/register\/patient\?inquiry=/)
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Synthetic')
  await page.reload()
  await expect(page.getByPlaceholder('patient@example.com')).toHaveValue('preparation-browser@example.test')
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  await page.getByLabel('Confirm Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  const registration = page.waitForResponse((response) => response.url().endsWith('/api/auth/register/patient'))
  await page.getByRole('button', { name: 'Create Patient Account' }).click()
  expect((await registration).status(), JSON.stringify(providerRequests)).toBe(200)
  await expect(page).toHaveURL(/patient-check-email/)
  await fixtureCommand('worker')
  const link = confirmationLinks.get('preparation-browser@example.test')
  expect(link, JSON.stringify(providerRequests)).toBeTruthy()
  expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(0)
  await fixtureCommand('pending', clinic.id)
  const otherDevice = await browser.newContext({ baseURL: origin, viewport: { width: 1024, height: 900 } })
  try {
    await setCookieConsent(otherDevice)
    const other = await otherDevice.newPage()
    const otherIssues = createBrowserIssueCollector(other, {
      ignoredConsoleErrors: [/Failed to load resource.*40[034]/, /net::ERR_FAILED/],
    })
    await other.goto(link!)
    await expect(other.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
    await other.getByRole('button', { name: 'Confirm email', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('region', { name: 'Inquiry submissions' })).toContainText('Not sent')
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: width < 640 ? 812 : 900 })
      await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await other.screenshot({ path: `${artifacts}/retry-${width}.png`, fullPage: true })
    }
    await other.setViewportSize({ width: 375, height: 400 })
    await other.getByRole('button', { name: 'Try again', exact: true }).scrollIntoViewIfNeeded()
    await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await other.screenshot({ path: `${artifacts}/retry-short-height.png`, fullPage: true })
    await other.setViewportSize({ width: 1024, height: 900 })
    await other.reload()
    await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(other.getByRole('region', { name: 'Inquiry submissions' }).getByRole('alert')).toContainText(
      'Please try sending this inquiry again before it expires.',
    )
    await fixtureCommand('approved', clinic.id)
    let readsUnavailable = true
    await other.route('**/api/patient/inquiry-preparations', async (route) => {
      if (readsUnavailable) await route.abort('failed')
      else await route.continue()
    })
    await other.route(
      '**/api/patient/inquiry-preparations/submit',
      async (route) => {
        // The real server commits, but the browser never receives its acknowledgement.
        const response = await route.fetch()
        expect(response.status()).toBe(200)
        await route.abort('failed')
      },
      { times: 1 },
    )
    await other.getByRole('button', { name: 'Try again', exact: true }).focus()
    await other.keyboard.press('Enter')
    const notices = other.getByRole('region', { name: 'Inquiry submissions' })
    await expect(notices).toContainText('Delivery not confirmed')
    await expect(notices).not.toContainText('saved but not sent')
    await expect(other.getByRole('button', { name: 'Try again', exact: true })).toHaveCount(0)
    expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(1)
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: width < 640 ? 640 : 900 })
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await other.screenshot({ path: `${artifacts}/unknown-outcome-${width}.png`, fullPage: true })
    }
    readsUnavailable = false
    await other.getByRole('button', { name: 'Check status', exact: true }).focus()
    await other.keyboard.press('Enter')
    await expect(
      other.getByRole('status').filter({ hasText: `Your inquiry to ${clinic.name} has been sent.` }),
    ).toBeVisible()
    await expect(other.getByRole('button', { name: 'Check status', exact: true })).toHaveCount(0)
    await expect(other.getByText(clinic.name, { exact: true }).first()).toBeVisible()
    await other.screenshot({ path: `${artifacts}/submitted-desktop.png`, fullPage: true })
    await other.reload()
    expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(1)
    await expectNoBrowserIssues(otherIssues)
  } finally {
    await otherDevice.close()
  }
  await expectNoBrowserIssues(issues)
})
