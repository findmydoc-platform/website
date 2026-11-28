import { expect, test } from '@playwright/test'

import { resolvePlaywrightBaseURL } from '../../../scripts/test-env.mjs'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { registerInquiryPreparationRuntime } from '../helpers/inquiryPreparationRuntime'
import type { createClinicReviewBrowserFixture } from '../../fixtures/createClinicReviewBrowserFixture'

const origin = resolvePlaywrightBaseURL()
const artifacts = 'output/playwright/clinic-reviews'
const runtime = registerInquiryPreparationRuntime({
  origin,
  artifacts,
  clinicCount: 0,
  templateKind: 'empty',
  setupTimeoutMs: 360_000,
})
let fixture: Awaited<ReturnType<typeof createClinicReviewBrowserFixture>>

test.beforeAll(async () => {
  fixture = (await runtime.fixtureCommand('review-profile')) as typeof fixture
})

const locales = [
  {
    locale: 'de',
    prefix: '',
    signIn: 'Anmelden',
    email: 'E-Mail',
    secretField: 'Passwort', // pragma: allowlist secret
    write: 'Bewertung schreiben',
    doctor: 'Ärztin oder Arzt',
    treatment: 'Behandlung',
    rating: 'Bewertung (1 bis 5 Sterne)',
    comment: 'Bewertungstext',
    submit: 'Bewertung absenden',
  },
  {
    locale: 'en',
    prefix: '/en',
    signIn: 'Sign in',
    email: 'Email',
    secretField: 'Password', // pragma: allowlist secret
    write: 'Write a review',
    doctor: 'Doctor',
    treatment: 'Treatment',
    rating: 'Rating (1 to 5 stars)',
    comment: 'Review text',
    submit: 'Submit review',
  },
] as const

for (const labels of locales) {
  test(`reads published reviews and submits a pending review in ${labels.locale} @smoke`, async ({ page, request }) => {
    const { locale, prefix } = labels
    const profilePath = `${prefix}/clinics/${fixture.slug}`
    const email = `review-browser-${locale}@example.test`
    const comment = `Browser fixture for ${locale}.\n\nA second paragraph for moderation.`
    const errors = createBrowserIssueCollector(page)
    const reviews = page.getByTestId('clinic-reviews-section')

    runtime.existingUser(email)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto(profilePath)
    await expect(page.locator('html')).toHaveAttribute('lang', locale)
    await expect(reviews.getByText(fixture.originalReview)).toBeVisible()
    await expect(reviews.getByRole('group').getByText(fixture.originalResponse)).toBeVisible()
    await expect(reviews.getByRole('note')).toBeVisible()
    await expect(reviews.getByText(fixture.hiddenReview)).toHaveCount(0)
    await reviews.screenshot({ path: `${artifacts}/${locale}-published.png` })

    await reviews.getByRole('link', { name: labels.signIn }).click()
    await expect(page).toHaveURL(
      (url) => url.pathname === `${prefix}/login/patient` && url.searchParams.get('next') === profilePath,
    )
    const login = page.getByRole('main')
    await login.getByLabel(labels.email, { exact: true }).fill(email)
    await login.getByLabel(labels.secretField, { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
    await login.getByRole('button', { name: labels.signIn, exact: true }).click()
    await expect(page).toHaveURL(profilePath)

    await reviews.getByRole('button', { name: labels.write }).click()
    const form = reviews.getByRole('form', { name: labels.write })
    const doctor = form.getByRole('combobox', { name: labels.doctor })
    await form.getByRole('button', { name: labels.submit }).click()
    await expect(doctor).toBeFocused()
    await expect(doctor).toHaveAttribute('aria-invalid', 'true')
    await expect(form.getByRole('alert')).toHaveCount(4)
    await form.screenshot({ path: `${artifacts}/${locale}-validation.png` })

    await doctor.selectOption(String(fixture.doctorId))
    await form.getByRole('combobox', { name: labels.treatment }).selectOption(String(fixture.treatmentId))
    await form.getByRole('combobox', { name: labels.rating }).selectOption('4')
    await form.getByRole('textbox', { name: labels.comment }).fill(comment)

    for (const width of [320, 375, 640, 768, 1024]) {
      await page.setViewportSize({ width, height: 812 })
      await expect(form.getByRole('button', { name: labels.submit })).toBeVisible()
      expect(await form.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
      await form.screenshot({ path: `${artifacts}/${locale}-form-${width}.png` })
    }

    await page.setViewportSize({ width: 375, height: 400 })
    const posted = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/reviews' && response.request().method() === 'POST',
    )
    await form.getByRole('button', { name: labels.submit }).click()
    const result = await posted
    expect(result.status()).toBe(201)
    const payload = (await result.json()) as { doc: { id: number; status: string } }
    expect(payload.doc.status).toBe('pending')
    const status = reviews.getByRole('status')
    await expect(status).toBeVisible()
    await expect(status).toBeFocused()
    await status.screenshot({ path: `${artifacts}/${locale}-submitted.png` })

    const publicRead = await request.get(`/api/reviews?where[id][equals]=${payload.doc.id}`)
    expect(publicRead.ok()).toBe(true)
    expect((await publicRead.json()).docs).toEqual([])
    await page.reload()
    await expect(reviews.getByText(comment)).toHaveCount(0)
    await expect(reviews.getByText(fixture.originalReview)).toBeVisible()
    await expectNoBrowserIssues(errors)
  })
}
