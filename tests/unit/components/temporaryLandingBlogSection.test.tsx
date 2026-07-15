// @vitest-environment jsdom

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TemporaryLandingBlogSection } from '@/components/templates/TemporaryLandingPage/TemporaryLandingBlogSection'

const posts = [
  {
    title: 'How to compare clinic quality signals',
    excerpt: 'A practical guide to structured comparisons.',
    href: '/posts/quality-signals',
    dateLabel: 'July 10, 2026',
  },
  {
    title: 'Questions to ask before treatment abroad',
    excerpt: 'Prepare your first conversation with a clinic.',
    href: '/posts/questions-before-treatment',
    dateLabel: 'July 8, 2026',
  },
  {
    title: 'Understanding treatment estimates',
    excerpt: 'Put estimates and included services into context.',
    href: '/posts/treatment-estimates',
    dateLabel: 'July 5, 2026',
  },
]

const renderSection = (visiblePosts = posts) =>
  render(
    <TemporaryLandingBlogSection
      ctaHref="/posts?locale=de"
      ctaLabel="Alle Beiträge ansehen"
      description="Praktische Orientierung zum Vergleich."
      posts={visiblePosts}
      title="Aktuelle Einblicke"
    />,
  )

describe('TemporaryLandingBlogSection', () => {
  it('renders a labelled section with named card links and a localized CTA', () => {
    renderSection()

    const heading = screen.getByRole('heading', { level: 2, name: 'Aktuelle Einblicke' })
    expect(heading.getAttribute('id')).toBe('temporary-landing-blog-heading')
    expect(heading.closest('section')?.getAttribute('aria-labelledby')).toBe('temporary-landing-blog-heading')
    expect(screen.getByRole('link', { name: posts[0]!.title }).getAttribute('href')).toBe(posts[0]!.href)
    expect(screen.getByRole('link', { name: posts[1]!.title }).getAttribute('href')).toBe(posts[1]!.href)
    expect(screen.getByRole('link', { name: posts[2]!.title }).getAttribute('href')).toBe(posts[2]!.href)
    expect(screen.getByRole('link', { name: 'Alle Beiträge ansehen' }).getAttribute('href')).toBe('/posts?locale=de')
  })

  it('keeps CTA and card links in a predictable tab order with visible focus styles', () => {
    renderSection(posts.slice(0, 2))

    const cta = screen.getByRole('link', { name: 'Alle Beiträge ansehen' })
    const firstCard = screen.getByRole('link', { name: posts[0]!.title })
    const secondCard = screen.getByRole('link', { name: posts[1]!.title })

    expect(screen.getAllByRole('link')).toEqual([cta, firstCard, secondCard])

    cta.focus()
    expect(document.activeElement).toBe(cta)

    firstCard.focus()
    expect(document.activeElement).toBe(firstCard)
    expect(firstCard.className).toContain('focus-visible:ring-2')

    secondCard.focus()
    expect(document.activeElement).toBe(secondCard)
  })

  it('renders nothing and exposes no focusable links when there are no posts', () => {
    const { container } = renderSection([])

    expect(container.innerHTML).toBe('')
    expect(screen.queryByRole('link')).toBeNull()
  })
})
