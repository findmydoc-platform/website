import { expect, test } from '@playwright/test'

import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsentState } from '../../../src/features/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const promptTitle = 'Help us improve findmydoc'

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
})

test('initial consent traps focus, cancels settings, and retains Escape rejection after reload and auth navigation @consent', async ({
  page,
  context,
}) => {
  const issues = createBrowserIssueCollector(page)
  await page.goto('/')
  const prompt = page.getByRole('dialog', { name: promptTitle })
  await expect(prompt.getByRole('heading', { name: promptTitle })).toBeFocused()
  for (let tab = 0; tab < 10; tab += 1) {
    await page.keyboard.press('Tab')
    await expect.poll(() => prompt.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await prompt.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('checkbox', { name: 'Analytics cookies' }).check()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(prompt.getByRole('heading', { name: promptTitle })).toBeFocused()
  expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)).toBeUndefined()
  await page.keyboard.press('Escape')
  await expect(prompt).toBeHidden()
  const rejected = (await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)!
  expect(parseCookieConsentState(rejected.value, 3)).toMatchObject({
    choice: 'rejected',
    categories: { analytics: false, functional: false, marketing: false },
  })
  expect(rejected.expires - Date.now() / 1000).toBeGreaterThan(89 * 24 * 60 * 60)
  expect(rejected.expires - Date.now() / 1000).toBeLessThanOrEqual(90 * 24 * 60 * 60)
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cookie settings', exact: true })).toBeVisible()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.goto('/login/patient')
  await expect(page.getByRole('dialog')).toBeHidden()
  expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)).toEqual(rejected)
  await expectNoBrowserIssues(issues)
})

test('later settings Escape discards drafts, restores launcher focus, and explicit withdrawal remains possible @consent', async ({
  page,
  context,
}) => {
  await setCookieConsent(context, { analytics: true, functional: true })
  await page.goto('/login/patient')
  const original = (await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)
  const launcher = page.getByRole('button', { name: 'Cookie settings', exact: true })
  await launcher.click()
  await page.getByRole('checkbox', { name: 'Analytics cookies' }).uncheck()
  await page.keyboard.press('Escape')
  await expect(launcher).toBeFocused()
  expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)).toEqual(original)
  await launcher.click()
  await expect(page.getByRole('checkbox', { name: 'Analytics cookies' })).toBeChecked()
  await page.getByRole('button', { name: 'Reject all', exact: true }).click()
  const rejected = (await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)!
  expect(parseCookieConsentState(rejected.value, 3)).toMatchObject({
    choice: 'rejected',
    categories: { analytics: false, functional: false },
  })
})

test('legal pages open before consent without a modal trap and ordinary routes still request a decision @consent', async ({
  page,
  context,
}) => {
  await page.goto('/')
  for (const label of ['Privacy Policy', 'Imprint']) {
    const popupPromise = page.waitForEvent('popup')
    await page
      .getByRole('dialog', { name: promptTitle })
      .getByRole('link', { name: new RegExp(label) })
      .click()
    const legal = await popupPromise
    await legal.waitForLoadState('domcontentloaded')
    await expect(legal.getByRole('button', { name: 'Cookie settings', exact: true })).toBeVisible()
    await expect(legal.getByRole('dialog')).toBeHidden()
    await expect(legal.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect((await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)).toBeUndefined()
    await legal.goto('/login/patient')
    await expect(legal.getByRole('dialog', { name: promptTitle })).toBeVisible()
    await legal.close()
  }
})

test('the shared auth prompt keeps full explanation and both decisions reachable at narrow and short sizes @consent', async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 375, height: 420 },
    { width: 640, height: 900 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/register/patient')
    const prompt = page.getByRole('dialog', { name: promptTitle })
    await expect(prompt.getByText(/record browsing sessions/)).toBeVisible()
    for (const label of ['Accept all', 'Reject all']) {
      const action = prompt.getByRole('button', { name: label, exact: true })
      await action.scrollIntoViewIfNeeded()
      await expect(action).toBeInViewport()
    }
    const bounds = await prompt.boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(0)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
    expect(bounds!.y).toBeGreaterThanOrEqual(0)
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
  }
})
