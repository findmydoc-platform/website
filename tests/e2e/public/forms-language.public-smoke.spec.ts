import { expect, test, type Locator, type Page } from '@playwright/test'

import { localizedFormScenario } from '../../fixtures/localizedFormScenario'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'
import { runLocalizedFormFixture } from '../helpers/localizedFormFixture'

const locales = ['de', 'en'] as const
type Locale = (typeof locales)[number]
const mode = process.env.PUBLIC_SITE_FALLBACK_MODE === 'holding' ? 'holding' : 'full'
const fixturePrefix = `e2e-localized-form-${Date.now()}`
const viewportWidths = [320, 375, 640, 768, 1024]

function formIssues(page: Page) {
  return createBrowserIssueCollector(page, {
    ignoredConsoleErrors: [/422.*\/api\/(?:form-bridge\/public-contact|form-submissions)/],
  })
}

async function expectLanguage(element: Locator, locale: Locale) {
  await expect(element).toBeVisible()
  await expect.poll(() => element.evaluate((node) => node.closest('[lang]')?.getAttribute('lang'))).toBe(locale)
}

async function checkViewports(page: Page, form: Locator) {
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 760 })
    await expect(form.getByRole('button', { name: /\S/ })).toBeVisible()
    expect(
      await form.evaluate((element) => element.scrollWidth - element.clientWidth),
      `Form overflow at ${width}px`,
    ).toBeLessThanOrEqual(1)
  }
  await page.setViewportSize({ width: 375, height: 640 })
}

async function expectAcceptedSubmission(
  page: Page,
  endpoint: string,
  button: Locator,
  checkPending: () => Promise<void>,
) {
  let continueSubmission!: () => void
  const pending = new Promise<void>((resolve) => (continueSubmission = resolve))
  await page.route(
    endpoint,
    async (route) => {
      await pending
      await route.continue()
    },
    { times: 1 },
  )

  const accepted = page.waitForResponse(endpoint)
  try {
    await button.click()
    await checkPending()
  } finally {
    continueSubmission()
  }
  expect((await accepted).ok()).toBe(true)
}

async function verifyContact(page: Page, url: string, locale: Locale, captureName: string) {
  const issues = formIssues(page)
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' })
  expect(response?.status()).toBe(200)
  if (mode === 'holding' && url.endsWith('/contact')) {
    expect(response?.headers()['x-robots-tag']).toContain('noindex')
  }

  const section = page.locator('#contact')
  const form = section.locator('form')
  const emailField = form.getByRole('textbox', { name: locale === 'de' ? /E-Mail/ : /Email/i })
  const nameField = form.getByRole('textbox', { name: 'Name', exact: true })
  const messageField = form.getByRole('textbox', { name: locale === 'de' ? /Nachricht/ : /Message/i })
  const button = form.getByRole('button', { name: /\S/ })
  const endpoint = '**/api/form-bridge/public-contact'
  await expectLanguage(emailField, locale)
  await expect(nameField).toHaveAccessibleName(/\S/)
  await expect(messageField).toHaveAccessibleName(/\S/)
  await checkViewports(page, form)

  await button.click()
  await expect(nameField).toBeFocused()
  await expect(nameField).toHaveAttribute('aria-invalid', 'true')
  await nameField.fill('Example Patient')
  await emailField.fill('invalid')
  await messageField.fill('Synthetic contact submission')
  await button.click()
  await expect(emailField).toBeFocused()
  await expect(emailField).toHaveAttribute('aria-invalid', 'true')
  await expectLanguage(form.getByRole('alert'), locale)
  await section.screenshot({ path: test.info().outputPath(`${captureName}-validation-${locale}-375.png`) })

  await emailField.fill('patient@example.test')
  await page.route(endpoint, (route) => route.fulfill({ status: 422, json: { error: 'Fixture bridge diagnostic' } }))
  await button.click()
  await expectLanguage(form.getByRole('alert'), locale)
  await expect(form.getByRole('status')).toHaveCount(0)
  await expect(messageField).toHaveValue('Synthetic contact submission')
  await page.unroute(endpoint)

  const originalSubmitLabel = await button.innerText()
  await expectAcceptedSubmission(page, endpoint, button, async () => {
    await expect(button).toBeDisabled()
    await expect(button).not.toHaveText(originalSubmitLabel)
  })
  await expectLanguage(form.getByRole('status'), locale)
  await expect(emailField).toHaveValue('')
  await section.screenshot({ path: test.info().outputPath(`${captureName}-accepted-${locale}-375.png`) })
  await expectNoBrowserIssues(issues)
}

test.describe('public forms in German and English', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })
  test.skip(Boolean(process.env.PLAYWRIGHT_BASE_URL), 'Seeds a local synthetic Page pair and contact sink.')

  test.beforeAll(() => {
    runLocalizedFormFixture('create', fixturePrefix, mode)
  })

  test.afterAll(() => {
    runLocalizedFormFixture('cleanup', fixturePrefix, mode)
  })

  test.beforeEach(async ({ context }) => {
    await setCookieConsent(context)
  })

  for (const locale of locales) {
    test(`${locale} contact page validates, rejects and accepts submissions @smoke`, async ({ page }) => {
      await verifyContact(page, locale === 'de' ? '/contact' : '/en/contact', locale, 'contact-page')
    })

    test(`${locale} Holding home validates, rejects and accepts submissions @smoke`, async ({ page }) => {
      test.skip(mode !== 'holding', 'Run with the Holding fallback to exercise its distinct home.')
      await verifyContact(page, locale === 'de' ? '/' : '/en', locale, 'holding-contact')
    })

    test(`${locale} published CMS form keeps its authored labels and return link @smoke`, async ({ page }) => {
      test.skip(mode !== 'full', 'CMS fixture pages are public in Full.')
      const issues = formIssues(page)
      const copy = localizedFormScenario[locale]
      const path = locale === 'de' ? `/${fixturePrefix}-de` : `/en/${fixturePrefix}-en`
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status()).toBe(200)
      const article = page.getByRole('article').filter({ hasText: copy.hint })
      const form = article.locator('form')
      await expectLanguage(form, locale)
      await checkViewports(page, form)
      await expect(article.getByText(copy.hint)).toBeVisible()
      const nameField = form.getByRole('textbox', { name: new RegExp(copy.name) })
      const select = form.getByRole('combobox', { name: new RegExp(copy.category) })
      const button = form.getByRole('button', { name: copy.submit })

      await button.click()
      await expect(nameField).toBeFocused()
      await expect(nameField).toHaveAttribute('aria-invalid', 'true')
      await nameField.fill('Fixture visitor')
      await button.click()
      await expect(select).toBeFocused()
      await expect(select).toHaveAttribute('aria-invalid', 'true')
      await expect(select).toHaveText(copy.categoryPrompt)
      await select.press('ArrowDown')
      await expect(page.getByRole('option', { name: copy.option })).toBeVisible()
      await page.keyboard.press('Enter')
      await expect(select).toHaveText(copy.option)

      const endpoint = '**/api/form-submissions'
      await page.route(endpoint, (route) => route.fulfill({ status: 422, json: { error: 'Fixture CMS diagnostic' } }))
      await button.click()
      await expectLanguage(article.getByRole('alert'), locale)
      await expect(article.getByRole('status')).toHaveCount(0)
      await expect(select).toHaveText(copy.option)
      await page.unroute(endpoint)

      await expectAcceptedSubmission(page, endpoint, button, async () => {
        await expect(button).toBeDisabled()
        await expectLanguage(article.getByRole('status'), locale)
      })
      const confirmation = article.getByRole('status')
      await expect(confirmation).toContainText(copy.confirmation)
      const returnLink = confirmation.getByRole('link', { name: copy.returnLabel })
      await expect(returnLink).toHaveAttribute('href', copy.returnHref)
      await article.screenshot({ path: test.info().outputPath(`cms-form-accepted-${locale}-375.png`) })
      await returnLink.click()
      await expect(page).toHaveURL(new RegExp(`${copy.returnHref}$`))
      await expectLanguage(page.getByRole('main').getByRole('heading', { level: 1 }), locale)
      await expectNoBrowserIssues(issues)
    })
  }
})
