import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  blogHeroComponent: vi.fn(() => null),
  buildPostsIndexJsonLdMock: vi.fn(() => [{ '@type': 'ItemList' }]),
  createSiteMetadataMock: vi.fn((args: unknown) => args),
  findPublishedPostsPageMock: vi.fn(),
  getPayloadMock: vi.fn(),
  jsonLdScriptComponent: vi.fn(() => null),
  normalizePostMock: vi.fn(),
  postsPaginationComponent: vi.fn(() => null),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mocks.getPayloadMock,
  }
})

vi.mock('@/utilities/content/serverData', () => ({
  findPublishedPostsPage: mocks.findPublishedPostsPageMock,
}))

vi.mock('@/utilities/blog/normalizePost', () => ({
  normalizePost: mocks.normalizePostMock,
}))

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadataMock,
}))

vi.mock('@/components/organisms/Blog/BlogHero', () => ({
  BlogHero: mocks.blogHeroComponent,
}))

vi.mock('@/app/(frontend)/posts/_components/PostsPagination', () => ({
  PostsPagination: mocks.postsPaginationComponent,
}))

vi.mock('@/utilities/structuredData', () => ({
  buildPostsIndexJsonLd: mocks.buildPostsIndexJsonLdMock,
  JsonLdScript: mocks.jsonLdScriptComponent,
}))

type ReactNodeLike = React.ReactNode

const findElementByType = (node: ReactNodeLike, type: unknown): React.ReactElement<Record<string, unknown>> | null => {
  if (Array.isArray(node)) {
    for (const child of node) {
      const match = findElementByType(child, type)
      if (match) {
        return match
      }
    }

    return null
  }

  if (!React.isValidElement(node)) {
    return null
  }

  const element = node as React.ReactElement<{ children?: ReactNodeLike }>

  if (element.type === type) {
    return element as React.ReactElement<Record<string, unknown>>
  }

  return findElementByType(element.props.children, type)
}

describe('frontend posts index route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.getPayloadMock.mockResolvedValue({})
    mocks.findPublishedPostsPageMock.mockResolvedValue({
      docs: [{ id: 1, slug: 'hello-world', title: 'Hallo Welt' }],
      totalDocs: 13,
      totalPages: 2,
      page: 1,
    })
    mocks.normalizePostMock.mockImplementation((post) => ({
      title: post.title,
      href: `/posts/${post.slug}?locale=de`,
    }))
  })

  it('passes the shared content locale through list queries, card normalization, and pagination paths', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.findPublishedPostsPageMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
        limit: 12,
      }),
    )
    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 1, slug: 'hello-world', title: 'Hallo Welt' },
      {
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
      },
    )

    const paginationElement = findElementByType(result, mocks.postsPaginationComponent) as React.ReactElement<{
      getPathForPage: (page: number) => string
    }> | null
    expect(paginationElement).not.toBeNull()
    expect(paginationElement?.props.getPathForPage(1)).toBe('/posts?locale=de')
    expect(paginationElement?.props.getPathForPage(2)).toBe('/posts/page/2?locale=de')

    const expectedBreadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts?locale=de' },
    ]
    const heroElement = findElementByType(result, mocks.blogHeroComponent) as React.ReactElement<{
      breadcrumbs: Array<{ href: string; label: string }>
    }> | null
    expect(heroElement?.props.breadcrumbs).toEqual(expectedBreadcrumbs)

    expect(mocks.buildPostsIndexJsonLdMock).toHaveBeenCalledWith({
      breadcrumbs: expectedBreadcrumbs,
      posts: [{ title: 'Hallo Welt', href: '/posts/hello-world?locale=de' }],
    })
    const jsonLdElement = findElementByType(result, mocks.jsonLdScriptComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(jsonLdElement?.props.data).toEqual([{ '@type': 'ItemList' }])
  })

  it('uses the requested content locale in metadata paths', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page')

    await pageModule.generateMetadata({
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts?locale=de',
      }),
    )
  })
})
