import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  blogHeroComponent: vi.fn(() => null),
  buildPostsIndexJsonLdMock: vi.fn(() => [{ '@type': 'ItemList' }]),
  createSiteMetadataMock: vi.fn((args: unknown) => args),
  getCachedPostArchivePageMock: vi.fn(),
  jsonLdScriptComponent: vi.fn(() => null),
  normalizePostMock: vi.fn(),
  postsPaginationComponent: vi.fn(() => null),
}))

vi.mock('@/utilities/content/serverData', () => ({
  getCachedPostArchivePage: mocks.getCachedPostArchivePageMock,
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

const getTextContent = (node: ReactNodeLike): string => {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(getTextContent).join(' ')
  if (!React.isValidElement(node)) return ''

  return getTextContent((node as React.ReactElement<{ children?: ReactNodeLike }>).props.children)
}

describe('frontend posts index route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.getCachedPostArchivePageMock.mockResolvedValue({
      docs: [
        {
          post: { id: 1, slug: 'hello-world', title: 'Hallo Welt' },
          locale: 'de',
          canonicalPath: '/posts/hello-world',
        },
        {
          post: { id: 2, slug: 'hello-eng', title: 'Hello world' },
          locale: 'en',
          canonicalPath: '/en/posts/hello-eng',
        },
      ],
      totalDocs: 13,
      totalPages: 2,
      page: 1,
    })
    mocks.normalizePostMock.mockImplementation((post) => ({
      title: post.title,
      href: `/posts/${post.slug}?locale=de`,
    }))
  })

  it('shows both card languages with their canonical paths and carries the locale preference to the next page', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.getCachedPostArchivePageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLocale: 'de',
      }),
    )
    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 1, slug: 'hello-world', title: 'Hallo Welt' },
      {
        contentLocale: {
          locale: 'de',
          fallbackLocale: false,
        },
      },
    )

    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 2, slug: 'hello-eng', title: 'Hello world' },
      { contentLocale: { locale: 'en', fallbackLocale: false } },
    )

    const paginationElement = findElementByType(result, mocks.postsPaginationComponent)
    expect(paginationElement?.props).toMatchObject({ contentLocale: { locale: 'de' }, totalPages: 2 })

    const expectedBreadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts?locale=de' },
    ]
    const heroElement = findElementByType(result, mocks.blogHeroComponent) as React.ReactElement<{
      breadcrumbs: Array<{ href: string; label: string }>
    }> | null
    expect(heroElement?.props.breadcrumbs).toEqual(expectedBreadcrumbs)

    expect(mocks.buildPostsIndexJsonLdMock).toHaveBeenCalledWith({
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/posts' },
      ],
      posts: [
        { title: 'Hallo Welt', href: '/posts/hello-world', locale: 'de' },
        { title: 'Hello world', href: '/en/posts/hello-eng', locale: 'en' },
      ],
    })
    const jsonLdElement = findElementByType(result, mocks.jsonLdScriptComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(jsonLdElement?.props.data).toEqual([{ '@type': 'ItemList' }])
  })

  it('uses the shared archive canonical URL', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page')

    pageModule.generateMetadata()

    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts',
      }),
    )
  })

  it('renders a visible localized empty state when no posts are published', async () => {
    mocks.getCachedPostArchivePageMock.mockResolvedValue({
      docs: [],
      totalDocs: 0,
      totalPages: 0,
      page: 1,
    })

    const pageModule = await import('@/app/(frontend)/posts/page')
    const result = await pageModule.default({
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    const emptySection = findElementByType(result, 'section')
    expect(emptySection?.props['aria-labelledby']).toBe('empty-posts-heading')
    expect(getTextContent(emptySection).trim()).not.toBe('')
    const englishResult = await pageModule.default({ searchParams: Promise.resolve({ locale: 'en' }) })
    const englishEmptySection = findElementByType(englishResult, 'section')
    expect(getTextContent(emptySection)).not.toEqual(getTextContent(englishEmptySection))
    expect(mocks.normalizePostMock).not.toHaveBeenCalled()
  })
})
