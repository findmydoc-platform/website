import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'

describe('BlogCardCollection', () => {
  it('renders placeholder image when none is provided', () => {
    const posts = [
      {
        title: 'No media',
        href: '/posts/no-media',
        excerpt: 'Testing layout without images.',
        dateLabel: '1 Jan 2024',
        readTime: '2 Min. Lesezeit',
      },
    ]

    const markup = renderToStaticMarkup(React.createElement(BlogCardCollection, { posts }))

    expect(markup).toContain('<img')
    expect(markup).toContain('Blog placeholder')
  })
})
