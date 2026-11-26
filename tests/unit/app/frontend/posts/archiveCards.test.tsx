// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom/vitest'
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { normalizeArchiveCard } from '@/app/(frontend)/posts/archiveCards'
import { Simple } from '@/components/organisms/Blog/BlogCard/Simple'

const publishedAt = '2026-01-15T12:00:00.000Z'
const post = {
  id: 77,
  title: 'Fixture title',
  slug: 'fixture',
  excerpt: 'Fixture excerpt',
  publishedAt,
  updatedAt: publishedAt,
}

describe('localized archive card metadata', () => {
  it.each([
    { locale: 'de', expectedDate: '15. Januar 2026', canonicalPath: '/posts/fixture' },
    { locale: 'en', expectedDate: 'January 15, 2026', canonicalPath: '/en/posts/fixture' },
  ] as const)(
    'renders published dates in the article language ($locale)',
    ({ locale, expectedDate, canonicalPath }) => {
      const card = normalizeArchiveCard({ post, locale, canonicalPath })

      render(
        <section lang={locale}>
          <Simple {...card} />
        </section>,
      )

      expect(screen.getByRole('link', { name: post.title })).toHaveAttribute('href', canonicalPath)
      expect(screen.getByText(expectedDate)).toBeVisible()
    },
  )

  it('uses a different editorial fallback for German cards and preserves named authors', () => {
    const english = normalizeArchiveCard({ post, locale: 'en', canonicalPath: '/en/posts/fixture' })
    const german = normalizeArchiveCard({ post, locale: 'de', canonicalPath: '/posts/fixture' })
    const named = normalizeArchiveCard({
      post: { ...post, populatedAuthors: [{ name: 'Fixture Author' }] },
      locale: 'de',
      canonicalPath: '/posts/fixture',
    })

    render(
      <>
        <section lang="en" aria-label="English fixture">
          <Simple {...english} />
        </section>
        <section lang="de" aria-label="German fixture">
          <Simple {...german} />
        </section>
        <Simple {...named} />
      </>,
    )

    const englishFixture = screen.getByRole('region', { name: 'English fixture' })
    const germanFixture = screen.getByRole('region', { name: 'German fixture' })
    const englishFallback = within(englishFixture).getByText(
      (_, element) => element?.tagName === 'SPAN' && element.textContent !== 'January 15, 2026',
    )
    expect(within(germanFixture).queryByText(englishFallback.textContent ?? '')).not.toBeInTheDocument()
    expect(german.author?.name).toBeTruthy()
    expect(screen.getByText('Fixture Author')).toBeVisible()
  })
})
