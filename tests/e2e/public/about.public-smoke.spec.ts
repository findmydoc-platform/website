import { expect, test, type Page } from '@playwright/test'

import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'
import { setCookieConsent } from '../helpers/cookieConsent'

const viewportMatrix = [
  { name: '320', width: 320, height: 760 },
  { name: '375', width: 375, height: 812 },
  { name: '640', width: 640, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1280', width: 1280, height: 720 },
  { name: '320-short', width: 320, height: 568 },
  { name: '375-short', width: 375, height: 640 },
] as const

const expectedSectionOrder = [
  /About findmydoc/,
  /Why findmydoc exists/,
  /findmydoc trust system scroll story/i,
  /The people accountable for the system/,
  /What stays transparent/,
  /Continue with clearer clinic context\./,
] as const

test.beforeEach(async ({ context }) => {
  await context.clearCookies()
  await setCookieConsent(context)
})

async function expectNoHorizontalOverflow(page: Page, viewportName: string) {
  const dimensions = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }))

  expect(dimensions.scrollWidth, `${viewportName} should not horizontally overflow`).toBeLessThanOrEqual(
    dimensions.innerWidth + 1,
  )
}

async function expectAboutSectionsInOrder(page: Page, viewportName: string) {
  const sectionOrder = await page
    .locator('h1, h2, section[aria-label="findmydoc trust system scroll story"]')
    .evaluateAll((nodes) =>
      nodes
        .map((node) => (node.getAttribute('aria-label') ?? node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
    )

  let previousIndex = -1

  for (const expectedSection of expectedSectionOrder) {
    const nextIndex = sectionOrder.findIndex((section, index) => index > previousIndex && expectedSection.test(section))

    expect(
      nextIndex,
      `${viewportName} section order should include ${String(expectedSection)} after index ${previousIndex}: ${sectionOrder.join(' -> ')}`,
    ).toBeGreaterThan(previousIndex)

    previousIndex = nextIndex
  }
}

async function scrollTrustStoryToProgress(page: Page, progress: number) {
  await page.locator('[data-testid="about-trust-system-story"]').evaluate((story, targetProgress) => {
    const maxScroll = Math.max(1, story.scrollHeight - window.innerHeight)
    const storyTop = window.scrollY + story.getBoundingClientRect().top

    window.scrollTo(0, storyTop + maxScroll * targetProgress)
    window.dispatchEvent(new Event('scroll'))
  }, progress)
}

test('about page composes the trust narrative across public viewports @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  for (const viewport of viewportMatrix) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/about', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { name: 'About findmydoc' })).toBeVisible()
    await expect(page.getByText(/Profile claims, qualifications, reviews, prices/i)).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Scattered information' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Comparison context' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Decision boundary' })).toBeVisible()
    await expectAboutSectionsInOrder(page, viewport.name)
    await expectNoHorizontalOverflow(page, viewport.name)

    const trustStory = page.getByRole('region', { name: /findmydoc trust system scroll story/i })
    await trustStory.scrollIntoViewIfNeeded()
    await expect(trustStory).toBeVisible()
    await expect(page.getByText(/Patient\s*Confidence/).first()).toBeVisible()
    await expectNoHorizontalOverflow(page, `${viewport.name} trust story`)

    await scrollTrustStoryToProgress(page, 0.96)
    await expect(trustStory.locator('[data-card="2"]')).toHaveAttribute('data-active', 'true')
    await expect(trustStory.locator('[data-ring-label="2"]')).toHaveAttribute('data-visible')
    await expectNoHorizontalOverflow(page, `${viewport.name} trust story final state`)

    const teamHeading = page.getByRole('heading', { name: 'The people accountable for the system' })
    await teamHeading.scrollIntoViewIfNeeded()
    await expect(teamHeading).toBeVisible()
    await expect(page.getByText(/Sets partner standards/i)).toBeVisible()
    await expect(page.getByText('Platform reliability')).toBeVisible()

    const transparencyHeading = page.getByRole('heading', { name: 'What stays transparent' })
    await transparencyHeading.scrollIntoViewIfNeeded()
    await expect(transparencyHeading).toBeVisible()
    await expect(page.getByText(/Comparison context stays separate from medical advice/i)).toBeVisible()
    await expect(page.getByText('Medical-advice separation')).toBeVisible()

    const closingHeading = page.getByRole('heading', { name: 'Continue with clearer clinic context.' })
    await closingHeading.scrollIntoViewIfNeeded()
    await expect(closingHeading).toBeVisible()
    const closingCta = page.getByRole('region', { name: 'Continue with clearer clinic context.' })
    await expect(closingCta.getByRole('link', { name: 'Compare clinics' })).toHaveAttribute(
      'href',
      '/listing-comparison',
    )
    await expect(closingCta.getByRole('link', { name: 'Register your clinic' })).toHaveAttribute(
      'href',
      '/partners/clinics',
    )
    await expectNoHorizontalOverflow(page, `${viewport.name} closing CTA`)
  }

  await expectNoBrowserIssues(issues)
})

test('about trust story respects reduced motion @smoke', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 640 })
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const trustStory = page.getByRole('region', { name: /findmydoc trust system scroll story/i })
  await trustStory.scrollIntoViewIfNeeded()
  await expect(trustStory.getByText('Patients start with uncertainty.').first()).toBeVisible()
  await expect(trustStory.getByText('We turn trust signals into clearer decisions.').first()).toBeVisible()
  await expect(trustStory.getByText('A clearer path forward for patients and clinics.').first()).toBeVisible()

  await scrollTrustStoryToProgress(page, 0.96)
  await expect(trustStory.getByText('Patients start with uncertainty.').first()).toBeVisible()
  await expect(trustStory.getByText('We turn trust signals into clearer decisions.').first()).toBeVisible()
  await expect(trustStory.getByText('A clearer path forward for patients and clinics.').first()).toBeVisible()
})
