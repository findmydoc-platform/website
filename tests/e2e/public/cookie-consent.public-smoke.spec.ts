import { expect, test, type BrowserContext } from '@playwright/test'

import {
  COOKIE_CONSENT_COOKIE_NAME,
  COOKIE_CONSENT_DEFAULT_VERSION,
  parseCookieConsentState,
} from '../../../src/features/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const readConsentCookie = async (context: BrowserContext) =>
  (await context.cookies()).find((cookie) => cookie.name === COOKIE_CONSENT_COOKIE_NAME)

const localizedCases = {
  de: {
    base: '',
    settings: 'Einstellungen',
    reopen: 'Cookie-Einstellungen',
    cancel: 'Abbrechen',
    accept: 'Alle akzeptieren',
    reject: 'Alle ablehnen',
    save: 'Auswahl speichern',
    analytics: 'Analyse-Cookies',
    functional: 'Funktionale Cookies',
  },
  en: {
    base: '/en',
    settings: 'Settings',
    reopen: 'Cookie settings',
    cancel: 'Cancel',
    accept: 'Accept all',
    reject: 'Reject all',
    save: 'Save preferences',
    analytics: 'Analytics cookies',
    functional: 'Functional cookies',
  },
} as const

const modes = {
  holding: process.env.E2E_CONSENT_SITE_MODE === 'holding',
  legal: process.env.E2E_HOLDING_LEGAL_SCENARIO,
}

for (const locale of ['de', 'en'] as const) {
  const copy = localizedCases[locale]
  const home = copy.base || '/'
  const auth = `${copy.base}/register/patient`
  const ordinary = modes.holding ? home : auth

  test(`${locale} prompt traps focus, discards unsaved settings and retains rejection after reload @consent`, async ({
    page,
    context,
  }) => {
    const issues = createBrowserIssueCollector(page)
    await page.goto(ordinary)
    const prompt = page.getByRole('dialog')
    await expect(prompt).toHaveAttribute('lang', locale)
    await expect(prompt.getByRole('heading')).toBeFocused()
    for (let tab = 0; tab < 10; tab += 1) {
      await page.keyboard.press('Tab')
      await expect.poll(() => prompt.evaluate((element) => element.contains(document.activeElement))).toBe(true)
    }

    await prompt.getByRole('button', { name: copy.settings, exact: true }).click()
    const settings = page.getByRole('dialog')
    await expect(settings).toHaveAttribute('lang', locale)
    await settings.getByRole('checkbox', { name: copy.analytics }).check()
    await settings.getByRole('button', { name: copy.cancel, exact: true }).click()
    await expect(prompt.getByRole('heading')).toBeFocused()
    expect(await readConsentCookie(context)).toBeUndefined()

    await page.keyboard.press('Escape')
    await expect(prompt).toBeHidden()
    const rejected = (await readConsentCookie(context))!
    expect(parseCookieConsentState(rejected.value, COOKIE_CONSENT_DEFAULT_VERSION)).toMatchObject({
      choice: 'rejected',
      categories: { analytics: false, functional: false, marketing: false },
    })
    expect(rejected.expires - Date.now() / 1000).toBeGreaterThan(89 * 24 * 60 * 60)
    expect(rejected.expires - Date.now() / 1000).toBeLessThanOrEqual(90 * 24 * 60 * 60)
    await page.reload()
    await expect(page.getByRole('button', { name: copy.reopen, exact: true })).toHaveAttribute('lang', locale)
    await expect(prompt).toBeHidden()
    expect(await readConsentCookie(context)).toEqual(rejected)
    await expectNoBrowserIssues(issues)
  })

  test(`${locale} settings can be reopened and recorded consent withdrawn @consent`, async ({ page, context }) => {
    await setCookieConsent(context, { analytics: true, functional: true })
    await page.goto(ordinary)
    const original = await readConsentCookie(context)
    const launcher = page.getByRole('button', { name: copy.reopen, exact: true })
    await launcher.click()
    await page.getByRole('checkbox', { name: copy.analytics }).uncheck()
    await page.keyboard.press('Escape')
    await expect(launcher).toBeFocused()
    expect(await readConsentCookie(context)).toEqual(original)
    await launcher.click()
    await expect(page.getByRole('checkbox', { name: copy.analytics })).toBeChecked()
    await page.getByRole('button', { name: copy.reject, exact: true }).click()
    const rejected = (await readConsentCookie(context))!
    expect(parseCookieConsentState(rejected.value, COOKIE_CONSENT_DEFAULT_VERSION)).toMatchObject({
      choice: 'rejected',
      categories: { analytics: false, functional: false },
    })
  })

  test(`${locale} published legal destinations open without a consent decision @consent`, async ({ page, context }) => {
    test.skip(!modes.legal, 'Requires the published managed legal fixtures')
    const legalLocale = locale === 'de' && modes.legal === 'bilingual' ? 'de' : 'en'
    const legalPrefix = localizedCases[legalLocale].base
    await page.goto(ordinary)
    for (const slug of ['privacy-policy', 'imprint']) {
      const href = `${legalPrefix}/${slug}`
      const link = page
        .getByRole('dialog')
        .getByRole('link')
        .and(page.locator(`a[href="${href}"]`))
      await expect(link).toBeVisible()
      if (locale !== legalLocale) await expect(link).toHaveAccessibleName(/\(EN\)/)
      const popupPromise = page.waitForEvent('popup')
      await link.click()
      const legal = await popupPromise
      await expect(legal.locator('html')).toHaveAttribute('lang', legalLocale)
      await expect(legal.getByRole('button', { name: localizedCases[legalLocale].reopen, exact: true })).toBeVisible()
      await expect(legal.getByRole('dialog')).toBeHidden()
      expect(await readConsentCookie(context)).toBeUndefined()
      await legal.close()
    }
    await page.getByRole('button', { name: copy.settings, exact: true }).click()
    await expect(page.getByRole('dialog').locator(`a[href="${legalPrefix}/privacy-policy"]`)).toBeVisible()
  })

  test(`${locale} prompt and settings controls stay reachable at narrow and short sizes @consent`, async ({
    page,
    context,
  }, testInfo) => {
    const issues = createBrowserIssueCollector(page)
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 375, height: 420 },
      { width: 640, height: 420 },
      { width: 768, height: 1024 },
      { width: 1024, height: 768 },
    ]) {
      await context.clearCookies()
      await page.setViewportSize(viewport)
      await page.goto(ordinary)
      const prompt = page.getByRole('dialog')
      await expect(prompt).toHaveAttribute('lang', locale)
      await expect(prompt).toHaveAccessibleDescription(/\S+/)
      for (const label of [copy.accept, copy.reject]) {
        const action = prompt.getByRole('button', { name: label, exact: true })
        await action.scrollIntoViewIfNeeded()
        await expect(action).toBeInViewport()
      }
      const bounds = await prompt.boundingBox()
      expect(bounds!.x).toBeGreaterThanOrEqual(0)
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width)
      expect(bounds!.y).toBeGreaterThanOrEqual(0)
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height)
      await prompt.getByRole('heading').scrollIntoViewIfNeeded()
      await page.screenshot({ path: testInfo.outputPath(`consent-prompt-${locale}-${viewport.width}.png`) })

      await prompt.getByRole('button', { name: copy.settings, exact: true }).click()
      const settings = page.getByRole('dialog')
      await expect(settings).toHaveAttribute('lang', locale)
      await settings.getByRole('checkbox', { name: copy.functional }).check()
      const save = settings.getByRole('button', { name: copy.save, exact: true })
      await save.scrollIntoViewIfNeeded()
      await expect(save).toBeInViewport()
      await page.screenshot({ path: testInfo.outputPath(`consent-settings-${locale}-${viewport.width}.png`) })
      await save.click()
      const launcher = page.getByRole('button', { name: copy.reopen, exact: true })
      await launcher.click()
      await expect(settings.getByRole('checkbox', { name: copy.functional })).toBeChecked()
      await expect(settings.getByRole('checkbox', { name: copy.analytics })).not.toBeChecked()
      await page.keyboard.press('Escape')
      await expect(launcher).toBeFocused()
    }
    await expectNoBrowserIssues(issues)
  })
}

test('client-side language navigation keeps the stored choice and relabels the launcher and settings @consent', async ({
  page,
  context,
}) => {
  await setCookieConsent(context, { functional: true })
  await page.goto(modes.holding ? '/' : '/register/patient')
  const original = await readConsentCookie(context)
  const document = await page.evaluateHandle(() => window.document)
  const germanLauncher = page.getByRole('button', { name: localizedCases.de.reopen, exact: true })
  await expect(germanLauncher).toHaveAttribute('lang', 'de')

  if (modes.holding) {
    await page.getByRole('link', { name: 'EN', exact: true }).click()
  } else {
    await page.getByRole('button', { name: /Sprache/ }).click()
    await page.getByRole('link', { name: /English|Englisch/ }).click()
  }

  await expect(page).toHaveURL(modes.holding ? /\/en$/ : /\/en\/register\/patient$/)
  expect(await document.evaluate((previous) => previous === window.document)).toBe(true)
  const englishLauncher = page.getByRole('button', { name: localizedCases.en.reopen, exact: true })
  await expect(englishLauncher).toHaveAttribute('lang', 'en')
  await englishLauncher.click()
  const settings = page.getByRole('dialog')
  await expect(settings).toHaveAttribute('lang', 'en')
  await expect(settings.getByRole('checkbox', { name: localizedCases.en.functional })).toBeChecked()
  await expect(settings.getByRole('checkbox', { name: localizedCases.en.analytics })).not.toBeChecked()
  expect(await readConsentCookie(context)).toEqual(original)
})
