import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'

describe('BlogCardCollection', () => {
  it('renders the blog heading and post content', () => {
    const posts = [
      {
        title: 'Healthy habits',
        href: '/posts/healthy-habits',
        excerpt: 'Short tips for daily wellness.',
        dateLabel: '10 May 2023',
        readTime: '5 Min. Lesezeit',
      },
      {
        title: 'Clinic news',
        href: '/posts/clinic-news',
        excerpt: 'Updates from our care team.',
        dateLabel: '22 Jun 2023',
        readTime: '3 Min. Lesezeit',
      },
      {
        title: 'Patient stories',
        href: '/posts/patient-stories',
        excerpt: 'Recovery journeys in focus.',
        dateLabel: '18 Jul 2023',
        readTime: '8 Min. Lesezeit',
      },
    ]

    const markup = renderToStaticMarkup(React.createElement(BlogCardCollection, { posts }))

    expect(markup).toContain('Blog')
    expect(markup).toContain('More Articles')
    posts.forEach((post) => {
      expect(markup).toContain(post.title)
      expect(markup).toContain(post.excerpt)
    })
  })

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
