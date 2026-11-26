// @vitest-environment jsdom
import React from 'react'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'

it('marks English reading time without changing the German related article title language', () => {
  render(
    <article lang="de">
      <RelatedPosts
        contentLocale={{ locale: 'de', fallbackLocale: false }}
        docs={[
          {
            title: 'Verwandter Beitrag',
            slug: 'verwandter-beitrag',
            populatedAuthors: [{ name: 'Ada' }],
            content: {
              root: {
                children: [{ type: 'text', version: 1, text: 'Lesbare Wörter' }],
                type: 'root',
                direction: null,
                format: '',
                indent: 0,
                version: 1,
              },
            },
          },
        ]}
      />
    </article>,
  )

  expect(screen.getByRole('heading', { name: 'Verwandter Beitrag' }).closest('[lang]')?.getAttribute('lang')).toBe('de')
  expect(screen.getByText('< 1 min read').closest('[lang]')?.getAttribute('lang')).toBe('en')
})

it('renders the related article placeholder as decorative', () => {
  render(<RelatedPosts docs={[{ title: 'Verwandter Beitrag', slug: 'verwandter-beitrag' }]} />)

  expect(screen.getByAltText('').getAttribute('src')).toContain('blog-placeholder')
})
