import { expect, test } from '@playwright/test'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'

const origin = `http://localhost:${process.env.INQUIRY_BROWSER_PORT ?? '3000'}`
const artifacts = 'output/playwright/inquiry-existing-account'
const { clinics, fixtureCommand, confirmationLinks, existingUser } = registerInquiryPreparationRuntime({
  origin,
  artifacts,
})

async function prepare(page: import('@playwright/test').Page, email: string) {
  await page.goto(`/clinics/${clinics[0]!.slug}`)
  const form = page.getByRole('form', { name: 'Clinic appointment request' })
  await form.getByRole('textbox', { name: 'First Name' }).fill('Entered')
  await form.getByRole('textbox', { name: 'Last Name' }).fill('Details')
  await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000090')
  await form.getByRole('textbox', { name: 'Email' }).fill(email)
  await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
  await form.getByRole('textbox', { name: 'Message' }).fill('Synthetic existing-account browser inquiry.')
  await form.getByRole('checkbox', { name: /process my contact details/ }).check()
  await form.getByRole('checkbox', { name: /authorize creation/ }).check()
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByRole('status')).toContainText('saved but not sent')
  await form.getByRole('link', { name: 'Continue account creation' }).click()
}

test('existing patient keeps inquiry details through sign-in and recovery navigation, then deliberately retries', async ({
  page,
  context,
}) => {
  existingUser('existing-browser@example.test')
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page, { ignoredConsoleErrors: [/Failed to load resource.*40[0134]/] })
  await page.setViewportSize({ width: 375, height: 812 })
  await prepare(page, 'existing-browser@example.test')
  await page.getByRole('link', { name: 'Sign in here' }).click()
  await expect(page).toHaveURL(/\/login\/patient/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  await expect(page.getByRole('status')).toContainText('saved but not sent')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/auth\/password\/reset/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  await expect(page.getByRole('status')).toContainText('saved but not sent')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${artifacts}/recovery-${width}.png`, fullPage: true })
  }
  await page.getByRole('link', { name: 'Patient sign in' }).click()
  await expect(page).toHaveURL(/\/login\/patient/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${artifacts}/login-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 375, height: 400 })
  await page.getByLabel('Password', { exact: true }).fill('WrongSyntheticPassword')
  const rejectedLogin = page.waitForResponse((response) => response.url().endsWith('/api/auth/login'))
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  expect((await rejectedLogin).status()).toBe(401)
  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible()
  await page.getByLabel('Password', { exact: true }).focus()
  await page.screenshot({ path: `${artifacts}/login-short-height.png`, fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await fixtureCommand('pending', clinics[0]!.id)
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPatient123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/patient\/inquiries$/)
  await expect(page.getByRole('region', { name: 'Unsent inquiries' })).toContainText(clinics[0]!.name)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.screenshot({ path: `${artifacts}/retry-mobile.png`, fullPage: true })
  await fixtureCommand('approved', clinics[0]!.id)
  await page.getByRole('button', { name: 'Try again', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Unsent inquiries' })).toHaveCount(0)
  await expect(page.getByText(clinics[0]!.name, { exact: true }).first()).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.screenshot({ path: `${artifacts}/submitted-desktop.png`, fullPage: true })
  await page.reload()
  expect(((await fixtureCommand('count', clinics[0]!.id)) as { totalDocs: number }).totalDocs).toBe(1)
  await expectNoBrowserIssues(issues)
})

test('existing unverified patient confirms on another device and proves their unchanged password before handoff', async ({
  page,
  context,
  browser,
}) => {
  existingUser('unverified-browser@example.test', false)
  const before = ((await fixtureCommand('count', clinics[0]!.id)) as { totalDocs: number }).totalDocs
  await setCookieConsent(context)
  await prepare(page, 'unverified-browser@example.test')
  await page.getByLabel('Password', { exact: true }).fill('IgnoredRegistrationPassword')
  await page.getByLabel('Confirm Password', { exact: true }).fill('IgnoredRegistrationPassword')
  await page.getByRole('button', { name: 'Create Patient Account' }).click()
  await expect(page).toHaveURL(/patient-check-email/)
  await fixtureCommand('worker')
  const link = confirmationLinks.get('unverified-browser@example.test')
  expect(link).toBeTruthy()
  const otherDevice = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 } })
  try {
    await setCookieConsent(otherDevice)
    const other = await otherDevice.newPage()
    const issues = createBrowserIssueCollector(other)
    await other.goto(link!)
    await other.getByRole('button', { name: 'Confirm email', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('link', { name: 'Sign in to send your inquiry' })).toBeVisible()
    await expect(other.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: 900 })
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await other.screenshot({ path: `${artifacts}/password-proof-${width}.png`, fullPage: true })
    }
    await other.getByRole('link', { name: 'Sign in to send your inquiry' }).click()
    await expect(other).toHaveURL(/\/login\/patient/)
    await other.getByLabel('Password', { exact: true }).fill('SyntheticPatient123')
    await other.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('region', { name: 'Unsent inquiries' })).toHaveCount(0)
    await expect(other.getByText(clinics[0]!.name, { exact: true }).first()).toBeVisible()
    expect(((await fixtureCommand('count', clinics[0]!.id)) as { totalDocs: number }).totalDocs).toBe(before + 1)
    await expectNoBrowserIssues(issues)
  } finally {
    await otherDevice.close()
  }
})
