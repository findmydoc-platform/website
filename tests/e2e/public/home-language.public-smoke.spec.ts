import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const scenario = process.env.E2E_FULL_HOME_SCENARIO
const germanHome = '/'
const englishHome = '/en'

const variants = [
  {
    locale: 'de',
    href: germanHome,
    destination: '/listing-comparison',
    specialty: 'Fachgebiet',
    implantOption: 'Zahnimplantate',
    location: 'Ort',
    submit: 'Kliniken finden',
    languageSwitcher: /Sprache/,
    alternateName: 'English',
    alternate: englishHome,
    categoryTabs: 'Nach Fachgebiet filtern',
  },
  {
    locale: 'en',
    href: englishHome,
    destination: '/en/listing-comparison',
    specialty: 'Specialty',
    implantOption: 'Dental Implants',
    location: 'Location',
    submit: 'Find clinics',
    languageSwitcher: /Language/,
    alternateName: 'Deutsch',
    alternate: germanHome,
    categoryTabs: 'Filter by specialty',
  },
] as const

test('an unpublished English home stays out of search and links back to German @full-home', async ({
  context,
  page,
  request,
}, testInfo) => {
  test.skip(scenario !== 'german-only', 'Requires a Full site with an unpublished English home')
  await setCookieConsent(context)
  await page.setViewportSize({ width: 375, height: 420 })

  const response = await page.goto(englishHome)
  expect(response?.status()).toBe(200)
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute('content', /noindex/)
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  const source = page.getByRole('main').getByRole('link').and(page.locator('a[href="/"][hreflang="de"]'))
  await expect(source).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('full-home-english-unavailable.png') })
  await source.click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'de')
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveCount(0)
  const sitemap = await request.get('/pages-sitemap.xml')
  expect(sitemap.status()).toBe(200)
  expect(await sitemap.text()).not.toMatch(/\/en<\/loc>/)
})

for (const variant of variants) {
  test(`${variant.locale} Full home keeps filters when starting a comparison @full-home`, async ({
    context,
    page,
    request,
  }, testInfo) => {
    test.skip(scenario !== 'bilingual', 'Requires both Full home renditions and the bilingual taxonomy baseline')
    test.setTimeout(120_000)
    await setCookieConsent(context)
    const issues = createBrowserIssueCollector(page)

    const response = await page.goto(variant.href, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale)
    const url = new URL(page.url())
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', url.href)
    for (const [locale, path] of [
      ['de', germanHome],
      ['en', englishHome],
      ['x-default', germanHome],
    ] as const) {
      await expect(page.locator(`link[rel="alternate"][hreflang="${locale}"]`)).toHaveAttribute(
        'href',
        new URL(path, url).href,
      )
    }

    const content = page.locator(`main > article[lang="${variant.locale}"]`)
    const specialty = content.getByRole('combobox', { name: variant.specialty, exact: true })
    const location = content.getByRole('combobox', { name: variant.location, exact: true })
    const submit = content.getByRole('button', { name: variant.submit, exact: true })

    for (const width of [320, 375, 640, 768, 1024, 1280]) {
      await page.setViewportSize({ width, height: width < 640 ? 600 : 840 })
      await expect(specialty).toBeVisible()
      await expect(submit).toBeVisible()
      await expect
        .poll(async () => page.evaluate(() => document.documentElement.scrollWidth))
        .toBeLessThanOrEqual(width)
      await page.screenshot({ path: testInfo.outputPath(`full-home-${variant.locale}-${width}.png`) })
    }

    await page.setViewportSize({ width: 375, height: 420 })
    const language = page.getByRole('banner').getByRole('button', { name: variant.languageSwitcher })
    await language.focus()
    await language.press('Enter')
    const alternate = page.getByRole('link', { name: variant.alternateName, exact: true })
    await expect(alternate).toHaveAttribute('href', variant.alternate)
    await alternate.press('Enter')
    await expect.poll(() => new URL(page.url()).pathname).toBe(variant.alternate)
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale === 'de' ? 'en' : 'de')
    await page.goBack()
    await expect(specialty).toBeVisible()

    const tabs = content.getByRole('tablist', { name: variant.categoryTabs })
    const tab = tabs.getByRole('tab', { selected: true })
    await tab.focus()
    await tab.press('ArrowRight')
    await expect(tabs.getByRole('tab', { selected: true })).toBeFocused()

    await specialty.focus()
    await specialty.press('Enter')
    const implant = page.getByRole('option', { name: variant.implantOption, exact: true })
    await expect(implant).toBeVisible()
    const specialtyId = await implant.getAttribute('data-value')
    expect(specialtyId).toMatch(/^\d+$/)
    await implant.click()
    await expect(specialty).toContainText(variant.implantOption)

    await location.click()
    const city = page.getByRole('option', { name: 'Istanbul', exact: true })
    const cityId = await city.getAttribute('data-value')
    expect(cityId).toMatch(/^\d+$/)
    await city.click()
    await content.getByRole('spinbutton', { name: 'Budget (EUR)' }).fill('3000')
    await submit.click()

    await expect.poll(() => new URL(page.url()).pathname).toBe(variant.destination)
    await expect
      .poll(() => Object.fromEntries(new URL(page.url()).searchParams))
      .toMatchObject({
        specialty: specialtyId,
        location: cityId,
        budget: '3000',
      })
    await expect(page.locator('html')).toHaveAttribute('lang', variant.locale)
    expect(await (await request.get('/pages-sitemap.xml')).text()).toContain(`${url.href}</loc>`)
    await expectNoBrowserIssues(issues)
  })
}
