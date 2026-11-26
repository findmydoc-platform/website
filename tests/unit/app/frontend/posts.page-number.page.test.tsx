import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  breadcrumbComponent: vi.fn(() => null),
  buildPostsIndexJsonLdMock: vi.fn(() => [{ '@type': 'ItemList' }]),
  createSiteMetadataMock: vi.fn((args: unknown) => args),
  getCachedPostArchivePageMock: vi.fn(),
  jsonLdScriptComponent: vi.fn(() => null),
  normalizePostMock: vi.fn(),
  notFoundMock: vi.fn(),
  postsPaginationComponent: vi.fn(() => null),
  redirectMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFoundMock,
  redirect: mocks.redirectMock,
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

vi.mock('@/components/molecules/Breadcrumb', () => ({
  Breadcrumb: mocks.breadcrumbComponent,
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

describe('frontend paginated posts route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.getCachedPostArchivePageMock.mockResolvedValue({
      docs: [
        {
          post: { id: 2, slug: 'page-2-post', title: 'Seite zwei' },
          locale: 'de',
          canonicalPath: '/posts/page-2-post',
        },
      ],
      totalDocs: 24,
      totalPages: 2,
      page: 2,
    })
    mocks.normalizePostMock.mockImplementation((post) => ({
      title: post.title,
      href: `/posts/${post.slug}?locale=de`,
    }))
  })

  it('preserves the locale when redirecting page 1 back to the posts index', async () => {
    const redirectError = new Error('redirected')
    mocks.redirectMock.mockImplementation(() => {
      throw redirectError
    })

    const pageModule = await import('@/app/(frontend)/posts/page/[pageNumber]/page')

    await expect(
      pageModule.default({
        params: Promise.resolve({ pageNumber: '1' }),
        searchParams: Promise.resolve({ locale: 'de' }),
      }),
    ).rejects.toBe(redirectError)

    expect(mocks.redirectMock).toHaveBeenCalledWith('/posts?locale=de')
  })

  it('keeps the locale preference and uses canonical card paths on later pages', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page/[pageNumber]/page')
    const result = await pageModule.default({
      params: Promise.resolve({ pageNumber: '2' }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.getCachedPostArchivePageMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredLocale: 'de',
        page: 2,
      }),
    )
    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 2, slug: 'page-2-post', title: 'Seite zwei' },
      {
        contentLocale: {
          locale: 'de',
          fallbackLocale: false,
        },
      },
    )

    const paginationElement = findElementByType(result, mocks.postsPaginationComponent)
    expect(paginationElement?.props).toMatchObject({ contentLocale: { locale: 'de' }, totalPages: 2 })

    const expectedBreadcrumbs = [
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts?locale=de' },
      { label: 'Page 2', href: '/posts/page/2?locale=de' },
    ]
    const breadcrumbElement = findElementByType(result, mocks.breadcrumbComponent) as React.ReactElement<{
      items: Array<{ href: string; label: string }>
    }> | null
    expect(breadcrumbElement?.props.items).toEqual(expectedBreadcrumbs)

    expect(mocks.buildPostsIndexJsonLdMock).toHaveBeenCalledWith({
      breadcrumbs: [
        { label: 'Home', href: '/' },
        { label: 'Blog', href: '/posts' },
        { label: 'Page 2', href: '/posts/page/2' },
      ],
      posts: [{ title: 'Seite zwei', href: '/posts/page-2-post', locale: 'de' }],
    })
    const jsonLdElement = findElementByType(result, mocks.jsonLdScriptComponent) as React.ReactElement<{
      data: unknown
    }> | null
    expect(jsonLdElement?.props.data).toEqual([{ '@type': 'ItemList' }])
  })

  it('keeps the canonical archive URL free of the locale query', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page/[pageNumber]/page')

    await pageModule.generateMetadata({
      params: Promise.resolve({ pageNumber: '2' }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts/page/2',
      }),
    )
  })
})
