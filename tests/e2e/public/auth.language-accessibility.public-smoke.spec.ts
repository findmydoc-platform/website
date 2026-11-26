import { expect, test, type Locator } from '@playwright/test'

import { setCookieConsent } from '../helpers/cookieConsent'

async function expectLanguage(target: Locator, language: 'de' | 'en') {
  await expect(target).toBeVisible()
  await expect.poll(() => target.evaluate((element) => element.closest('[lang]')?.getAttribute('lang'))).toBe(language)
}

test('German patient sign-in gives English site controls and dialogs their own language @smoke', async ({
  context,
  page,
}) => {
  await setCookieConsent(context)
  await page.setViewportSize({ width: 375, height: 400 })
  await page.goto('/login/patient', { waitUntil: 'domcontentloaded' })

  const header = page.getByRole('banner')
  const footer = page.getByRole('contentinfo')
  const heading = page.getByRole('main').getByRole('heading', { level: 1 })
  await expectLanguage(heading, 'de')
  await expectLanguage(header, 'en')
  await expectLanguage(footer, 'en')
  const previewNotice = page.getByRole('note', { name: 'Preview data notice' })
  if (await previewNotice.isVisible()) await expectLanguage(previewNotice, 'en')

  await header.getByRole('button', { name: 'Open menu' }).click()
  await expectLanguage(header.getByRole('navigation', { name: 'Mobile navigation' }), 'en')
  await header.getByRole('button', { name: 'Close menu' }).click()
  await expect(header.getByRole('navigation', { name: 'Mobile navigation' })).toHaveCount(0)

  await header.getByRole('button', { name: 'Sign in, open account menu' }).click()
  await expectLanguage(page.getByRole('menu'), 'en')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('menu')).toHaveCount(0)

  const cookieSettings = page.getByRole('button', { name: 'Cookie settings' })
  await expectLanguage(cookieSettings, 'en')
  const form = page.getByRole('main').getByRole('heading', { level: 1 }).locator('xpath=ancestor::section')
  await cookieSettings.scrollIntoViewIfNeeded()
  const [formBox, settingsBox] = await Promise.all([form.boundingBox(), cookieSettings.boundingBox()])
  expect(formBox).not.toBeNull()
  expect(settingsBox).not.toBeNull()
  expect(settingsBox!.y - (formBox!.y + formBox!.height)).toBeGreaterThanOrEqual(27)
  await cookieSettings.click()
  await expectLanguage(page.getByRole('dialog'), 'en')
  await page.screenshot({ path: test.info().outputPath('patient-login-cookie-settings-375.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cookieSettings).toBeFocused()
  await expectLanguage(heading, 'de')
  await footer.getByRole('link', { name: 'Privacy Policy' }).click()
  await expect(page).toHaveURL(/\/privacy-policy$/)
  await expect(cookieSettings).toHaveCount(1)
  await cookieSettings.click()
  await expect(page.getByRole('dialog')).toBeVisible()
})

test('the English consent prompt is marked on German patient registration @smoke', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 400 })
  await page.goto('/register/patient', { waitUntil: 'domcontentloaded' })
  const prompt = page.getByRole('dialog')
  await expectLanguage(prompt, 'en')
  await prompt.getByRole('button', { name: 'Reject all' }).click()
  await expect(prompt).toHaveCount(0)
  const heading = page.getByRole('main').getByRole('heading', { level: 1 })
  await expectLanguage(heading, 'de')
  await expect(heading).toBeFocused()
})
