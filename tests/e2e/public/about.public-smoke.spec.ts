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
  'H1',
  'about-signal-context-heading',
  'about-trust-system-story-heading',
  'about-accountability-heading',
  'about-boundary-heading',
  'about-closing-actions-heading',
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
  const selector = expectedSectionOrder.map((id) => (id === 'H1' ? 'h1' : `h2#${id}`)).join(', ')
  const sectionOrder = await page
    .locator(selector)
    .evaluateAll((nodes) => nodes.map((node) => (node.tagName === 'H1' ? 'H1' : node.id)))

  expect(sectionOrder, `${viewportName} should preserve the About section order`).toEqual(expectedSectionOrder)
}

async function scrollTrustStoryToProgress(page: Page, progress: number) {
  await page.locator('[data-testid="about-trust-system-story"]').evaluate((story, targetProgress) => {
    const maxScroll = Math.max(1, story.scrollHeight - window.innerHeight)
    const storyTop = window.scrollY + story.getBoundingClientRect().top

    window.scrollTo(0, storyTop + maxScroll * targetProgress)
    window.dispatchEvent(new Event('scroll'))
  }, progress)
}

test('about page keeps its section order without horizontal overflow across public viewports @smoke', async ({
  page,
}) => {
  test.setTimeout(120_000)

  const issues = createBrowserIssueCollector(page)

  for (const viewport of viewportMatrix) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/about', { waitUntil: 'domcontentloaded' })

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(/\S/)
    await expectAboutSectionsInOrder(page, viewport.name)
    await expectNoHorizontalOverflow(page, viewport.name)
  }

  await expectNoBrowserIssues(issues)
})

test('about page exposes the trust story, team controls, and closing actions @smoke', async ({ page }) => {
  const issues = createBrowserIssueCollector(page)

  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const trustStory = page.getByRole('region', { name: /findmydoc trust system scroll story/i })
  await trustStory.scrollIntoViewIfNeeded()
  await expect(trustStory).toBeVisible()
  await scrollTrustStoryToProgress(page, 0.96)
  await expect(trustStory.locator('[data-card="2"]')).toHaveAttribute('data-active', 'true')
  await expect(trustStory.locator('[data-ring-label="2"]')).toHaveAttribute('data-visible')

  const teamSpotlight = page.locator('[data-about-team-spotlight]')
  const volkanTab = page.getByRole('tab', { name: /Volkan Kablan/i })
  const sebastianTab = page.getByRole('tab', { name: /Sebastian Schütze/i })

  await expect(volkanTab).toHaveAttribute('aria-selected', 'true')
  await sebastianTab.click()
  await expect(teamSpotlight.getByRole('heading', { name: 'Sebastian Schütze' })).toBeVisible()
  await expect(sebastianTab).toHaveAttribute('aria-selected', 'true')
  await sebastianTab.press('Home')
  await expect(volkanTab).toHaveAttribute('aria-selected', 'true')
  await volkanTab.press('End')
  await expect(sebastianTab).toHaveAttribute('aria-selected', 'true')

  const closingCta = page.locator('section[aria-labelledby="about-closing-actions-heading"]')
  await expect(closingCta.getByRole('link')).toHaveCount(2)
  await expect(closingCta.locator('a[href="/listing-comparison"]')).toHaveAccessibleName(/\S/)
  await expect(closingCta.locator('a[href="/partners/clinics"]')).toHaveAccessibleName(/\S/)
  await expectNoHorizontalOverflow(page, '375 interactive states')
  await expectNoBrowserIssues(issues)
})

test('about trust story respects reduced motion @smoke', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: 375, height: 640 })
  await page.goto('/about', { waitUntil: 'domcontentloaded' })

  const trustStory = page.getByRole('region', { name: /findmydoc trust system scroll story/i })
  await trustStory.scrollIntoViewIfNeeded()
  const cards = trustStory.locator('[data-card]')

  await expect(cards).toHaveCount(3)
  await expect
    .poll(() =>
      cards.evaluateAll((elements) =>
        elements.map((element) => {
          const style = window.getComputedStyle(element)
          return {
            opacity: style.opacity,
            pointerEvents: style.pointerEvents,
            position: style.position,
          }
        }),
      ),
    )
    .toEqual(
      Array.from({ length: 3 }, () => ({
        opacity: '1',
        pointerEvents: 'auto',
        position: 'relative',
      })),
    )
})
