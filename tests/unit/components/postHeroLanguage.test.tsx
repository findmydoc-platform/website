// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { BlogCard } from '@/components/organisms/Blog/BlogCard'
import { PostHero } from '@/components/organisms/Heroes/PostHero'

it('announces German editorial text and the fixed English Hero text in their respective languages', () => {
  render(
    <article lang="de">
      <PostHero
        title="Grüner Tee"
        breadcrumbs={[
          { href: '/', label: 'Home' },
          { href: '/posts/gruener-tee', label: 'Grüner Tee', lang: 'de' },
        ]}
        readTime="1 min read"
        readTimeLang="en"
      />
    </article>,
  )

  expect(screen.getByRole('heading', { name: 'Grüner Tee' }).closest('[lang]')?.getAttribute('lang')).toBe('de')
  expect(screen.getByRole('link', { name: 'Home' }).closest('[lang]')?.getAttribute('lang')).toBe('en')
  expect(
    screen.getByText('Grüner Tee', { selector: '[aria-current=page]' }).closest('[lang]')?.getAttribute('lang'),
  ).toBe('de')
  expect(screen.getByText('Editorial Team', { exact: true }).closest('[lang]')?.getAttribute('lang')).toBe('en')
  expect(screen.getByText('1 min read').closest('[lang]')?.getAttribute('lang')).toBe('en')
})

it('marks an English category title on a German article', () => {
  render(
    <article lang="de">
      <PostHero title="Grüner Tee" categories={['Patient Guides']} categoryLang="en" />
    </article>,
  )

  expect(screen.getByText('Patient Guides').getAttribute('lang')).toBe('en')
})

it.each(['Simple', 'Overlay', 'Overview', 'Enhanced'] as const)(
  'marks a German title on an English %s card',
  (variant) => {
    const Card = BlogCard[variant]
    render(
      <section lang="en">
        <Card title="Aftercare Abroad" href="/en/posts/aftercare" category="Nachsorge" categoryLang="de" />
      </section>,
    )

    expect(screen.getByText('Nachsorge').getAttribute('lang')).toBe('de')
    expect(screen.getByRole('link', { name: 'Aftercare Abroad' })).toBeDefined()
  },
)
