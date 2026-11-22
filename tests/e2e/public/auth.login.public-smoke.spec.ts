import { expect, test } from '@playwright/test'

import { AUTH_FLASH_STORAGE_KEY, createPasswordResetCompleteFlash } from '@/auth/utilities/authFlash'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const locales = [
  {
    locale: 'de',
    path: '/login/patient',
    email: 'E-Mail',
    password: 'Passwort',
    submit: 'Anmelden',
  },
  {
    locale: 'en',
    path: '/en/login/patient',
    email: 'Email',
    password: 'Password',
    submit: 'Sign in',
  },
] as const

test.beforeEach(async ({ context }) => {
  await setCookieConsent(context)
})

for (const copy of locales) {
  test(`patient login allows correction of invalid input in ${copy.locale} @smoke`, async ({ page }) => {
    const issues = createBrowserIssueCollector(page)
    await page.goto(copy.path)
    const email = page.getByLabel(copy.email, { exact: true })
    const password = page.getByLabel(copy.password, { exact: true })
    const submit = page.getByRole('button', { name: copy.submit, exact: true })

    await email.fill('not-an-email')
    await submit.click()
    await expect(email).toBeFocused()
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    await expect(password).toHaveAttribute('aria-invalid', 'true')
    for (const field of [email, password]) {
      const error = await field.getAttribute('aria-describedby')
      await expect(page.getByRole('alert').and(page.locator(`[id="${error}"]`))).toBeVisible()
    }

    await email.fill('patient@example.com')
    await expect(email).not.toHaveAttribute('aria-invalid')
    await expectNoBrowserIssues(issues)
  })
}

for (const copy of locales) {
  test(`patient login reports failure and retries successfully in ${copy.locale} @smoke`, async ({
    page,
  }, testInfo) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [/Failed to load resource: the server responded with a status of 401 .*\/api\/auth\/login/],
    })
    const providerDetail = 'Unexpected provider detail for the browser test'
    const nextPath = '/privacy-policy?from=patient-login'
    const submissions: unknown[] = []
    let finishFailure = () => {}
    const failureCanFinish = new Promise<void>((resolve) => {
      finishFailure = resolve
    })
    await page.route('**/api/auth/login', async (route) => {
      submissions.push(route.request().postDataJSON())
      if (submissions.length === 1) {
        await failureCanFinish
        await route.fulfill({ status: 401, json: { error: 'Invalid login credentials', message: providerDetail } })
      } else {
        await route.fulfill({
          json: {
            success: true,
            redirectUrl: '/patient/inquiries',
            user: { id: 'patient-1', email: 'patient@example.com', userType: 'patient' },
          },
        })
      }
    })

    const loginUrl = `${copy.path}?next=${encodeURIComponent(nextPath)}`
    await page.setViewportSize({ width: 375, height: 500 })
    await page.goto(loginUrl)
    const email = page.getByLabel(copy.email, { exact: true })
    const password = page.getByLabel(copy.password, { exact: true })
    const form = page.getByRole('main').locator('form')
    const submit = form.locator('button[type="submit"]')
    const pending = form.getByRole('status')
    const firstPassword = 'RejectedFixturePassword' // pragma: allowlist secret
    const secondPassword = 'AcceptedFixturePassword' // pragma: allowlist secret

    await expect(pending).toBeEmpty()
    await email.fill('patient@example.com')
    await password.fill(firstPassword)
    try {
      await submit.click()
      await expect(submit).toBeDisabled()
      await expect(email).toBeDisabled()
      await expect(password).toBeDisabled()
      await expect(pending).toContainText(/\S/)
      await submit.evaluate((button) => button.scrollIntoView({ block: 'center' }))
      await page.screenshot({ path: testInfo.outputPath(`patient-login-${copy.locale}-pending-375x500.png`) })
      for (const width of [320, 375, 640, 768, 1024]) {
        await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        await page.screenshot({
          path: testInfo.outputPath(`patient-login-${copy.locale}-pending-${width}.png`),
          fullPage: true,
        })
      }
      await page.setViewportSize({ width: 375, height: 500 })
    } finally {
      finishFailure()
    }

    const error = page.getByRole('main').getByRole('alert')
    await expect(error).toBeVisible()
    await expect(error).not.toContainText(providerDetail)
    await expect(pending).toBeEmpty()
    await page.screenshot({ path: testInfo.outputPath(`patient-login-${copy.locale}-failure-375x500.png`) })
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === loginUrl)
    await expect(submit).toBeEnabled()
    await expect(email).toHaveValue('patient@example.com')
    await password.fill(secondPassword)
    await submit.click()
    await expect(page).toHaveURL((url) => `${url.pathname}${url.search}` === nextPath, { timeout: 20_000 })
    expect(submissions).toEqual([
      { email: 'patient@example.com', password: firstPassword, allowedUserTypes: ['patient'] },
      { email: 'patient@example.com', password: secondPassword, allowedUserTypes: ['patient'] },
    ])
    await expectNoBrowserIssues(issues)
  })
}

test('patient login announces registration and password reset in the requested language @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)
  const registrationFeedback: string[] = []
  const recoveryFeedback: string[] = []
  const feedback = page.getByRole('main').getByRole('status').filter({ hasText: /\S/ })

  for (const copy of locales) {
    await page.goto(`${copy.path}?message=patient-check-email`)
    await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
    await expect(feedback).toBeVisible()
    registrationFeedback.push(await feedback.innerText())

    const recoveryFlash = await page.addInitScript(
      ({ path, key, flash }) => {
        if (window === window.top && location.pathname === path && !location.search) {
          sessionStorage.setItem(key, JSON.stringify(flash))
        }
      },
      { path: copy.path, key: AUTH_FLASH_STORAGE_KEY, flash: createPasswordResetCompleteFlash() },
    )
    try {
      await page.goto(copy.path)
    } finally {
      await recoveryFlash.dispose()
    }

    await expect(page.locator('html')).toHaveAttribute('lang', copy.locale)
    await expect(feedback).toBeVisible()
    recoveryFeedback.push(await feedback.innerText())
    expect(await page.evaluate((key) => sessionStorage.getItem(key), AUTH_FLASH_STORAGE_KEY)).toBeNull()
    await page.reload()
    await expect(feedback).toHaveCount(0)
  }

  expect(new Set(registrationFeedback).size).toBe(locales.length)
  expect(new Set(recoveryFeedback).size).toBe(locales.length)
  await expectNoBrowserIssues(issues)
})

test('patient login switches languages and confirms before discarding a password @smoke', async ({
  page,
}, testInfo) => {
  const issues = createBrowserIssueCollector(page)
  const loginContext = '?next=%2Fpatient%2Finquiries&message=patient-check-email'
  const enteredPassword = 'LanguageSwitchFixturePassword' // pragma: allowlist secret

  await page.setViewportSize({ width: 320, height: 500 })
  await page.goto(`${locales[0].path}${loginContext}`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')

  const header = page.getByRole('banner')
  const languageButton = header.getByRole('button', { name: /Sprache/ })
  await expect(languageButton).toContainText('DE')
  const menuButton = header.getByRole('button', { name: 'Open menu' })
  const accountButton = header.getByRole('button', { name: /open account menu/i })
  const boxes = await Promise.all([languageButton, menuButton, accountButton].map((button) => button.boundingBox()))
  for (const box of boxes) {
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box!.y + box!.height / 2).toBeCloseTo(boxes[0]!.y + boxes[0]!.height / 2, 0)
  }

  const email = page.getByLabel(locales[0].email, { exact: true })
  const password = page.getByLabel(locales[0].password, { exact: true })
  await email.fill('patient@example.com')
  await password.fill(enteredPassword)

  await languageButton.focus()
  await page.keyboard.press('Enter')
  const languageMenu = page.getByRole('dialog', { name: /Sprache/ })
  await expect(languageMenu.locator('[aria-current="true"]')).toHaveAttribute('lang', 'de')
  const english = languageMenu.getByRole('link', { name: 'English', exact: true })
  await expect(english).toHaveAttribute('hreflang', 'en')
  await expect(english).toBeFocused()
  await testInfo.attach('language-menu-accessibility-tree', {
    body: await languageMenu.ariaSnapshot(),
    contentType: 'text/yaml',
  })
  await page.screenshot({ path: testInfo.outputPath('login-language-menu-320x500.png') })
  await page.keyboard.press('Enter')

  const confirmation = page.getByRole('dialog', { name: /Sprache wechseln/ })
  const stay = confirmation.getByRole('button', { name: 'Im Formular bleiben' })
  await expect(stay).toBeFocused()
  await page.screenshot({ path: testInfo.outputPath('login-language-confirmation-320x500.png') })
  await page.keyboard.press('Escape')
  await expect(languageButton).toBeFocused()
  await expect(password).toHaveValue(enteredPassword)

  for (const name of ['Schließen', 'Im Formular bleiben']) {
    await languageButton.click()
    await english.click()
    await confirmation.getByRole('button', { name, exact: true }).click()
    await expect(page).toHaveURL(`/login/patient${loginContext}`)
    await expect(email).toHaveValue('patient@example.com')
    await expect(password).toHaveValue(enteredPassword)
  }

  await languageButton.click()
  await english.click()
  await confirmation.getByRole('button', { name: 'Trotzdem zu Englisch wechseln', exact: true }).click()
  await expect(page).toHaveURL(`/en/login/patient${loginContext}`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.getByLabel(locales[1].email, { exact: true })).toHaveValue('patient@example.com')
  await expect(page.getByLabel(locales[1].password, { exact: true })).toBeEmpty()

  const englishLanguageButton = header.getByRole('button', { name: /Language/ })
  await expect(englishLanguageButton).toContainText('EN')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: width === 320 ? 345 : 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
    await englishLanguageButton.click()
    const options = page.getByRole('dialog', { name: 'Language' })
    await expect(options.locator('[aria-current="true"]')).toHaveAttribute('lang', 'en')
    await page.screenshot({ path: testInfo.outputPath(`login-language-en-${width}.png`) })
    await page.keyboard.press('Escape')
    await expect(englishLanguageButton).toBeFocused()
  }

  await englishLanguageButton.click()
  await page.getByRole('link', { name: 'Deutsch', exact: true }).click()
  await expect(page).toHaveURL(`/login/patient${loginContext}`)
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(email).toHaveValue('patient@example.com')
  await expectNoBrowserIssues(issues)
})
