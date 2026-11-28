import { expect, test } from '@playwright/test'

import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import { expectRobotsIndexingBlocked } from '../helpers/robots'

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/saved-clinics'
const runtime = registerInquiryPreparationRuntime({ origin, artifacts })

const languages = [
  {
    locale: 'de',
    prefix: '',
    languageMenu: /^Sprache/,
    alternate: 'English',
    alternatePrefix: '/en',
    submit: 'Anmelden',
    save: (clinic: string) => `${clinic} speichern`,
    remove: (clinic: string) => `${clinic} aus gespeicherten Kliniken entfernen`,
  },
  {
    locale: 'en',
    prefix: '/en',
    languageMenu: /^Language/,
    alternate: 'Deutsch',
    alternatePrefix: '',
    submit: 'Sign in',
    save: (clinic: string) => `Save ${clinic} to saved clinics`,
    remove: (clinic: string) => `Remove ${clinic} from saved clinics`,
  },
] as const

for (const { locale, prefix, languageMenu, alternate, alternatePrefix, submit, save, remove } of languages) {
  test(`saves and removes a clinic through the ${locale} comparison and private saved list`, async ({
    page,
    context,
    request,
  }) => {
    const clinic = runtime.clinics[0]!
    const email = `saved-clinics-${locale}@example.test`
    const listPath = `${prefix}/patient/favorites`
    const entry = `${prefix}/listing-comparison?sort=name-asc`
    const loginPath = `${prefix}/login/patient`
    const issues = createBrowserIssueCollector(page)

    runtime.existingUser(email)
    await setCookieConsent(context)
    await page.setViewportSize({ width: 375, height: 812 })

    await page.goto(entry)
    const saveLink = page.getByRole('link', { name: save(clinic.name) })
    await saveLink.focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL((url) => url.pathname === loginPath && url.searchParams.get('next') === entry)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)

    const form = page.getByRole('main').getByRole('form')
    await form.locator('input[type="email"]').fill(email)
    await form.locator('input[type="password"]').fill('SyntheticPatient123') // pragma: allowlist secret
    await form.getByRole('button', { name: submit, exact: true }).click()
    await expect(page).toHaveURL(entry)

    const unsavedAction = page.getByRole('button', { name: save(clinic.name) })
    await expect(unsavedAction).toHaveAttribute('aria-pressed', 'false')
    await unsavedAction.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('button', { name: remove(clinic.name) })).toHaveAttribute('aria-pressed', 'true')

    const listResponse = await page.goto(listPath)
    expect(listResponse?.headers()['cache-control']).toMatch(/private.*no-store/)
    const main = page.getByRole('main')
    const list = main.getByRole('list')
    await expect(list.getByRole('heading', { name: clinic.name })).toBeVisible()
    await expectRobotsIndexingBlocked(page)

    const guest = await request.get(listPath, { maxRedirects: 0 })
    expect(guest.status()).toBe(307)
    const target = new URL(guest.headers().location!, origin)
    expect(target.pathname).toBe(loginPath)
    expect(target.searchParams.get('next')).toBe(listPath)
    expect(await guest.text()).not.toContain(clinic.name)

    for (const width of [320, 375, 640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: 812 })
      await expect(list.getByRole('button', { name: remove(clinic.name) })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await page.screenshot({ path: `${artifacts}/${locale}-populated-${width}.png`, fullPage: true })
    }

    await page.setViewportSize({ width: 375, height: 400 })
    await page.getByRole('banner').getByRole('button', { name: languageMenu }).click()
    await page.getByRole('dialog').getByRole('link', { name: alternate }).click()
    await expect(page).toHaveURL(`${alternatePrefix}/patient/favorites`)
    await expect(list.getByRole('heading', { name: clinic.name })).toBeVisible()
    await page.goto(listPath)

    const removeAction = list.getByRole('button', { name: remove(clinic.name) })
    await removeAction.focus()
    await page.keyboard.press('Enter')
    await expect(list).toHaveCount(0)
    await expect(main.getByRole('status')).toContainText(clinic.name)
    await expect(main.getByRole('link')).toBeFocused()
    await page.screenshot({ path: `${artifacts}/${locale}-removed-short.png`, fullPage: true })
    await page.reload()
    await expect(main.getByRole('link')).toHaveAttribute('href', `${prefix}/listing-comparison`)
    await expect(list).toHaveCount(0)
    await expectNoBrowserIssues(issues)
  })
}
