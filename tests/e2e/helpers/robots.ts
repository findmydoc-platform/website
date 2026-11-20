import { expect, type Page } from '@playwright/test'

export async function expectRobotsIndexingBlocked(page: Page) {
  const robots = page.locator('meta[name="robots"]')
  await expect(robots.first()).toBeAttached()

  const directives = await robots.evaluateAll((tags) =>
    tags.map((tag) => (tag.getAttribute('content') ?? '').toLowerCase().split(/[\s,]+/)),
  )
  expect(directives.length).toBeGreaterThan(0)
  for (const tag of directives) {
    expect(tag).toEqual(expect.arrayContaining(['noindex', 'nofollow']))
  }
}
