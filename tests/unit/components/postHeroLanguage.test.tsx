// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

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
