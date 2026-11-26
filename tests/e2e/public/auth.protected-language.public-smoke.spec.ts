import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { resolveRecoveryKeys } from '../../../src/auth/actions/recoveryConfiguration'
import { resolveVerificationKeys } from '../../../src/auth/actions/verificationConfiguration'
import {
  pendingPatientContext,
  setPatientVerificationContext,
  PATIENT_VERIFICATION_COOKIE,
} from '../../../src/auth/actions/patientVerificationContext'
import {
  confirmedWebsiteRecovery,
  pendingWebsiteRecovery,
  setWebsiteRecoveryContext,
  WEBSITE_RECOVERY_COOKIE,
} from '../../../src/auth/actions/websiteRecoveryContext'
import { expect, test } from '@playwright/test'

import { setCookieConsent } from '../helpers/cookieConsent'
import { expectRobotsIndexingBlocked } from '../helpers/robots'

for (const type of ['recovery', 'patient-verification']) {
  test(`${type} can switch language on the protected confirmation page @smoke`, async ({ page, context }) => {
    await setCookieConsent(context)
    await page.goto(`/auth/confirm?type=${type}&lang=en`, { waitUntil: 'domcontentloaded' })
    const main = page.getByRole('main')
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
    await expect(main.locator('a[hreflang]')).toHaveCount(0)
    await page.getByRole('banner').getByRole('button', { name: 'Sprache, DE' }).click()
    const english = page.getByRole('dialog').getByRole('link', { name: 'English', exact: true })
    await expect(english).toHaveAttribute('hreflang', 'en')
    await english.click()
    await expect(page).toHaveURL(`/auth/en/confirm?type=${type}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await expect(main.getByRole('alert')).toBeVisible()
    await expectRobotsIndexingBlocked(page)

    await page.getByRole('banner').getByRole('button', { name: 'Language, EN' }).click()
    const german = page.getByRole('dialog').getByRole('link', { name: 'Deutsch', exact: true })
    await expect(german).toHaveAttribute('hreflang', 'de')
    await german.click()
    await expect(page).toHaveURL(`/auth/confirm?type=${type}`)
    await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  })
}

test('the English confirmation alias only serves a single supported flow @smoke', async ({ page, request }) => {
  for (const search of ['', '?type=invite', '?type=recovery&type=patient-verification', '?type=unknown']) {
    const response = await request.get(`/auth/en/confirm${search}`)
    expect(response.status()).toBe(404)
  }

  await page.goto('/auth/confirm?type=invite', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByRole('main').locator('a[hreflang]')).toHaveCount(0)
})

function hasLocalTestKeys(value: string | undefined, baseURL: string | undefined) {
  if (!baseURL || !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) return false
  try {
    return JSON.parse(value ?? '').environment === 'test'
  } catch {
    return false
  }
}

test('an active recovery switches language and completes through the localized login @smoke', async ({
  baseURL,
  context,
  page,
}) => {
  test.skip(
    !hasLocalTestKeys(process.env.AUTH_RECOVERY_CORRELATION_KEYS_JSON, baseURL),
    'Requires the local test recovery key ring.',
  )
  await setCookieConsent(context)
  const keys = resolveRecoveryKeys('test')
  const pending = pendingWebsiteRecovery(1, randomUUID(), 'patient-recovery', 'test', 'a'.repeat(56))
  const cookie = new NextResponse()
  setWebsiteRecoveryContext(cookie, pending, keys)
  await context.addCookies([
    {
      name: WEBSITE_RECOVERY_COOKIE,
      value: cookie.cookies.get(WEBSITE_RECOVERY_COOKIE)!.value,
      url: new URL('/auth/', baseURL).href,
      httpOnly: true,
    },
  ])
  await page.route('**/auth/callback?flow=recovery', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ csrf: pending.csrf })
    const confirmed = new NextResponse()
    setWebsiteRecoveryContext(confirmed, confirmedWebsiteRecovery(pending), keys)
    await route.fulfill({
      headers: { 'set-cookie': confirmed.headers.get('set-cookie')!.replace(/; Secure/i, '') },
      json: { redirectTo: '/auth/password/reset/complete' },
    })
  })
  const password = 'SyntheticRecovery124' // pragma: allowlist secret
  await page.route('**/auth/password/complete', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ csrf: pending.csrf, password, confirmPassword: password })
    await route.fulfill({ json: { redirectTo: '/login/patient?status=recovery-complete' } })
  })

  await page.goto('/auth/confirm?type=recovery')
  await page.getByRole('banner').getByRole('button', { name: 'Sprache, DE' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL('/auth/en/confirm?type=recovery')
  await page.getByRole('main').getByRole('button', { name: 'Confirm recovery' }).click()
  await expect(page).toHaveURL('/auth/en/password/reset/complete')
  await page.setViewportSize({ width: 768, height: 500 })
  const language = page.getByRole('banner').getByRole('button', { name: 'Language, EN' })
  await language.click()
  const options = page.getByRole('dialog', { name: 'Language' })
  await expect(options.getByRole('link')).toHaveCount(0)
  const [optionsBox, headingBox] = await Promise.all([
    options.boundingBox(),
    page.getByRole('main').getByRole('heading', { level: 1 }).boundingBox(),
  ])
  expect(optionsBox).not.toBeNull()
  expect(headingBox).not.toBeNull()
  expect(optionsBox!.y + optionsBox!.height).toBeLessThanOrEqual(headingBox!.y)
  await page.screenshot({ path: test.info().outputPath('recovery-complete-language-768.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(language).toBeFocused()
  await page.getByLabel('New password', { exact: true }).fill(password)
  await page.getByLabel('Confirm password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page).toHaveURL('/en/login/patient?status=recovery-complete')
  const feedback = page.getByRole('status').filter({ hasText: /\S/ })
  await expect(feedback).toBeVisible()
  await page.reload()
  await expect(feedback).toHaveCount(0)
})

test('an active patient verification stays usable after switching languages @smoke', async ({
  baseURL,
  context,
  page,
}) => {
  test.skip(
    !hasLocalTestKeys(process.env.AUTH_VERIFICATION_CORRELATION_KEYS_JSON, baseURL),
    'Requires the local test verification key ring.',
  )
  await setCookieConsent(context)
  const keys = resolveVerificationKeys('test')
  const response = new NextResponse()
  setPatientVerificationContext(response, pendingPatientContext(1, randomUUID(), 'test', 'a'.repeat(56)), keys)
  await context.addCookies([
    {
      name: PATIENT_VERIFICATION_COOKIE,
      value: response.cookies.get(PATIENT_VERIFICATION_COOKIE)!.value,
      url: new URL('/auth/', baseURL).href,
      httpOnly: true,
    },
  ])
  await page.goto('/auth/confirm?type=patient-verification')
  await page.getByRole('banner').getByRole('button', { name: 'Sprache, DE' }).click()
  await page.getByRole('dialog').getByRole('link', { name: 'English' }).click()
  await expect(page).toHaveURL('/auth/en/confirm?type=patient-verification')
  await expect(page.getByRole('main').getByRole('button', { name: 'Confirm email' })).toBeEnabled()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
})
