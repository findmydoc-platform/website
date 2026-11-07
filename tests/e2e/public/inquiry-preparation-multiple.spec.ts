import { expect, test } from '@playwright/test'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
type Clinic = { id: number; slug: string; name: string; doctorId: number | string }

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/inquiry-preparation-multiple'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts, clinicCount: 3 })
const { fixtureCommand, confirmationLinks, providerRequests } = runtime

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
    await page.goto(`/clinics/${destination.slug}`)
    const form = page.getByRole('form', { name: 'Clinic appointment request' })
    await form.getByRole('textbox', { name: 'First Name' }).fill('Synthetic')
    await form.getByRole('textbox', { name: 'Last Name' }).fill('Patient')
    await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000081')
    await form.getByRole('textbox', { name: 'Email' }).fill(email)
    await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
    await form.getByRole('textbox', { name: 'Message' }).fill(message)
    await form.getByRole('checkbox', { name: /process my contact details/ }).check()
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
