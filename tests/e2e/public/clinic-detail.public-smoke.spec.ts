import { execFileSync } from 'node:child_process'

import { expect, test } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

function runFixtureCommand(args: string[]) {
  return execFileSync('pnpm', ['exec', 'tsx', 'scripts/public-e2e-clinic-fixture.ts', ...args], {
    cwd: process.cwd(),
    env: process.env,
    encoding: 'utf8',
  })
}

type InquiryLookup = {
  found: boolean
  clinic?: number | string | null
  doctor?: number | string | null
  treatment?: number | string | null
  status?: string
  email?: string
  createdAt?: string
  count: number
  totalClinicCount: number
}

function readInquiry(prefix: string, email: string): InquiryLookup {
  const output = runFixtureCommand(['read-inquiry', '--prefix', prefix, '--email', email])
  const lines = output.trim().split('\n').filter(Boolean)
  const lastLine = lines.at(-1)

  if (!lastLine) {
    throw new Error('Inquiry lookup did not return output.')
  }

  return JSON.parse(lastLine) as InquiryLookup
}

test.describe('clinic detail map dialog', () => {
  test.describe.configure({ mode: 'serial' })

  const slugPrefix = `e2e-clinic-map-${Date.now()}`
  let clinicSlug = ''

  test.beforeAll(async () => {
    const output = runFixtureCommand(['create', '--prefix', slugPrefix])
    const lines = output.trim().split('\n').filter(Boolean)
    const lastLine = lines.at(-1)

    if (!lastLine) {
      throw new Error('Fixture creation did not return a clinic slug.')
    }

    clinicSlug = (JSON.parse(lastLine) as { slug?: string }).slug ?? ''

    if (!clinicSlug) {
      throw new Error('Fixture creation returned an empty clinic slug.')
    }
  })

  test.afterAll(async () => {
    runFixtureCommand(['cleanup', '--prefix', slugPrefix])
  })

  test('opens the expanded map as an accessible dialog and restores focus on close @smoke', async ({
    page,
    context,
  }) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/en/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' })
    await expect(breadcrumb.getByRole('link', { name: 'Home' })).toBeVisible()
    await expect(breadcrumb.getByRole('link', { name: 'Clinics' })).toBeVisible()
    await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Clinic Location' })).toBeVisible()

    const previewMap = page.getByTitle(/Map preview of/)
    await expect(previewMap).toBeVisible()
    await expect(previewMap).toHaveAttribute('tabindex', '0')

    const expandMapButton = page.getByRole('button', { name: 'Expand map' })
    await expandMapButton.click()

    const dialog = page.getByRole('dialog', { name: 'Expanded Map View' })
    const interactiveMap = dialog.getByTitle(/Interactive map of/)

    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('link', { name: 'View map in OpenStreetMap' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).toBeVisible()
    await expect(interactiveMap).toBeVisible()
    await expect(interactiveMap).toHaveAttribute('tabindex', '-1')
    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog', { name: 'Expanded Map View' })).not.toBeVisible()
    await expect(expandMapButton).toBeFocused()
    await expectNoBrowserIssues(issues)
  })

  test('hides OpenStreetMap controls when functional consent is rejected @smoke', async ({ page, context }) => {
    const issues = createBrowserIssueCollector(page)

    await context.clearCookies()
    await setCookieConsent(context)

    await page.goto(`/en/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page.getByText('OpenStreetMap is hidden until optional cookies are accepted.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Expand map' })).not.toBeVisible()
    await expect(page.getByRole('link', { name: 'Directions' })).not.toBeVisible()
    await expectNoBrowserIssues(issues)
  })

  test('saves authorized clinic inquiries without delivering them before account completion @smoke', async ({
    page,
    context,
  }) => {
    const issues = createBrowserIssueCollector(page, {
      ignoredConsoleErrors: [
        /Failed to load resource: the server responded with a status of 404 .*openstreetmap\.org\//,
      ],
    })
    const email = `${slugPrefix}-contact@example.com`
    const secondEmail = `${slugPrefix}-contact-second@example.com`

    await context.clearCookies()
    await setCookieConsent(context, { functional: true })

    await page.goto(`/en/clinics/${clinicSlug}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    const [selectedDoctorId] = await page.locator('select[name="doctor"]').selectOption({ index: 1 })
    expect(selectedDoctorId).toBeTruthy()
    await page.getByLabel('First Name').fill(slugPrefix)
    await page.getByLabel('Last Name').fill('Patient')
    await page.getByLabel('Phone Number').fill('+49 30 123456')
    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(email)
    await page.getByLabel('How Soon Are You Considering Treatment?').selectOption('within_two_weeks')
    await page.getByLabel('When Should We Contact You?').selectOption('morning')
    await page.getByLabel('Message').fill('Please contact me about this clinic.')
    await page.getByLabel(/I agree that findmydoc may process/i).check()

    await page.getByRole('checkbox', { name: /authorize creation/i }).check()
    await page.getByRole('button', { name: 'Save inquiry and create account' }).click()

    await expect(page.getByRole('status')).toContainText('Your inquiry is saved but not sent.')
    await expect(page.getByRole('button', { name: 'Inquiry saved, not sent' })).toBeDisabled()

    expect(readInquiry(slugPrefix, email)).toMatchObject({ found: false, count: 0, totalClinicCount: 0 })

    await page.locator('form[aria-label="Clinic appointment request"]').evaluate((form: HTMLFormElement) => {
      form.requestSubmit()
    })

    await expect.poll(() => readInquiry(slugPrefix, email).count).toBe(0)
    expect(readInquiry(slugPrefix, email).totalClinicCount).toBe(0)

    await page.getByRole('textbox', { name: 'Email', exact: true }).fill(secondEmail)
    await expect(page.getByRole('button', { name: 'Save inquiry and create account' })).toBeEnabled()
    await page.getByRole('checkbox', { name: /authorize creation/i }).check()
    await page.getByRole('button', { name: 'Save inquiry and create account' }).click()

    await expect(page.getByRole('status')).toContainText('Your inquiry is saved but not sent.')
    await expect(page.getByRole('button', { name: 'Inquiry saved, not sent' })).toBeDisabled()

    expect(readInquiry(slugPrefix, secondEmail)).toMatchObject({ found: false, count: 0, totalClinicCount: 0 })

    await expectNoBrowserIssues(issues)
  })
})

test.describe('published clinic overview languages', () => {
  const prefix = `e2e-clinic-overview-${Date.now()}`
  const fixtureSlugs = new Map<string, string>()

  test.beforeAll(() => {
    for (const variant of ['complete', 'sparse', 'unpublished']) {
      const output = runFixtureCommand(['create', '--prefix', `${prefix}-${variant}`, '--overview', variant])
      const result = JSON.parse(output.trim().split('\n').at(-1) ?? '{}') as { slug?: string }
      if (!result.slug) throw new Error(`Missing clinic fixture slug for ${variant}`)
      fixtureSlugs.set(variant, result.slug)
    }
  })

  test.afterAll(() => {
    runFixtureCommand(['cleanup', '--prefix', prefix])
  })

  test('published clinic profiles reciprocate their canonical aliases and protect unpublished profiles @smoke', async ({
    page,
    request,
    context,
  }) => {
    await setCookieConsent(context)
    for (const variant of ['complete', 'sparse']) {
      const slug = fixtureSlugs.get(variant)
      const paths = { de: `/clinics/${slug}`, en: `/en/clinics/${slug}` }
      for (const locale of ['de', 'en'] as const) {
        const path = paths[locale]
        const response = await request.get(path, { headers: { 'user-agent': 'Googlebot' } })
        expect(response.status()).toBe(200)
        expect(response.headers()['x-robots-tag']).toBeUndefined()
        await page.goto(path)
        await expect(page.locator('html')).toHaveAttribute('lang', locale)
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
        expect(canonical && new URL(canonical, page.url()).pathname).toBe(path)
        for (const [language, target] of Object.entries({ ...paths, 'x-default': paths.de })) {
          const href = await page.locator(`link[rel="alternate"][hreflang="${language}"]`).getAttribute('href')
          expect(href && new URL(href, page.url()).pathname).toBe(target)
        }
        await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0)
      }
    }

    for (const prefix of ['', '/en']) {
      const response = await request.get(`${prefix}/clinics/${fixtureSlugs.get('unpublished')}`)
      expect(response.status()).toBe(404)
    }
  })

  test('keeps locale, clinic facts and gallery navigation across both overview languages @smoke', async ({
    page,
    context,
  }, testInfo) => {
    test.setTimeout(120_000)
    const issues = createBrowserIssueCollector(page)
    await setCookieConsent(context)
    const slug = fixtureSlugs.get('complete')
    const profile = {
      de: {
        prefix: '',
        description: 'Profiltest Klinikbeschreibung',
        city: 'Profilteststadt',
        alt: 'Eingang zur Profiltestklinik',
        caption: 'Profiltest Bildtitel',
        gallery: /^Foto ansehen/,
        language: 'Sprache',
      },
      en: {
        prefix: '/en',
        description: 'Profile test clinic description',
        city: 'Profile Test City',
        alt: 'Entrance to the profile test clinic',
        caption: 'Profile test caption',
        gallery: /^View photo/,
        language: 'Language',
      },
    }
    await page.goto(`/clinics/${slug}`)
    const name = await page.getByRole('heading', { level: 1 }).textContent()
    for (const locale of ['de', 'en'] as const) {
      const copy = profile[locale]
      await page.setViewportSize({ width: 1280, height: 900 })
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(name ?? '')
      await expect(page.getByText(copy.description, { exact: true })).toBeVisible()
      await expect(page.getByText(new RegExp(copy.city))).toBeVisible()
      await expect(page.getByRole('img', { name: copy.alt })).toBeVisible()
      for (const width of [320, 375, 640, 768, 1024, 1280]) {
        await page.setViewportSize({ width, height: width === 640 ? 390 : 760 })
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
        const openGallery = page.getByRole('button', { name: copy.gallery })
        await openGallery.focus()
        await page.keyboard.press('Enter')
        const gallery = page.getByRole('dialog')
        await expect(gallery).toBeVisible()
        await expect(gallery.getByText(copy.caption, { exact: true })).toBeVisible()
        if (width === 640) {
          await page.screenshot({
            path: testInfo.outputPath(`clinic-gallery-${locale}-short.png`),
            animations: 'disabled',
          })
        }
        await page.keyboard.press('Escape')
        await expect(gallery).not.toBeVisible()
        await expect(openGallery).toBeFocused()
      }
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({ path: testInfo.outputPath(`clinic-overview-${locale}.png`), animations: 'disabled' })
      const alternate = locale === 'de' ? 'en' : 'de'
      await page
        .getByRole('banner')
        .getByRole('button', { name: new RegExp(copy.language) })
        .click()
      await page
        .getByRole('dialog', { name: copy.language })
        .getByRole('link', { name: alternate === 'en' ? 'English' : 'Deutsch' })
        .click()
      await expect(page).toHaveURL((url) => url.pathname === `${profile[alternate].prefix}/clinics/${slug}`)
    }
    await expectNoBrowserIssues(issues)
  })
})
