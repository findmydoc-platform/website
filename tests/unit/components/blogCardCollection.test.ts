import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { BlogCardCollection } from '@/components/organisms/Blog/BlogCardCollection'

describe('BlogCardCollection', () => {
  it('renders the blog heading and post content', () => {
    const posts = [
      { title: 'Healthy habits', excerpt: 'Short tips for daily wellness.', dateLabel: '10 May 2023' },
      { title: 'Clinic news', excerpt: 'Updates from our care team.', dateLabel: '22 Jun 2023' },
      { title: 'Patient stories', excerpt: 'Recovery journeys in focus.', dateLabel: '18 Jul 2023' },
    ]

    const markup = renderToStaticMarkup(React.createElement(BlogCardCollection, { posts }))

    expect(markup).toContain('Blog')
    posts.forEach((post) => {
      expect(markup).toContain(post.title)
      expect(markup).toContain(post.excerpt)
      expect(markup).toContain(post.dateLabel)
    })
  })

  it('omits images when none are provided', () => {
    const posts = [{ title: 'No media', excerpt: 'Testing layout without images.', dateLabel: '1 Jan 2024' }]

    const markup = renderToStaticMarkup(React.createElement(BlogCardCollection, { posts }))

    expect(markup).not.toContain('<img')
  })
})
