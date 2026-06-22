import { describe, expect, it, vi } from 'vitest'

import { buildBreadcrumbListJsonLd } from '@/utilities/structuredData/breadcrumbs'

vi.mock('@/utilities/getURL', () => ({
  getServerSideURL: vi.fn(() => 'https://findmydoc.eu/'),
}))

describe('breadcrumb structured data', () => {
  it('builds BreadcrumbList JSON-LD from shared breadcrumb items', () => {
    const result = buildBreadcrumbListJsonLd([
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts' },
      { label: 'Article', href: '/posts/article' },
    ])

    expect(result).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: 'https://findmydoc.eu/',
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: 'https://findmydoc.eu/posts',
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Article',
          item: 'https://findmydoc.eu/posts/article',
        },
      ],
    })
  })

  it('skips invalid one-item trails instead of emitting partial JSON-LD', () => {
    expect(buildBreadcrumbListJsonLd([{ label: 'Home', href: '/' }])).toBeNull()
  })
})
