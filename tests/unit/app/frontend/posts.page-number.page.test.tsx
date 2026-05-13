import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  countPublishedPostsMock: vi.fn(),
  createSiteMetadataMock: vi.fn((args: unknown) => args),
  findPublishedPostsPageMock: vi.fn(),
  getPayloadMock: vi.fn(),
  normalizePostMock: vi.fn(),
  notFoundMock: vi.fn(),
  postsPaginationComponent: vi.fn(() => null),
  redirectMock: vi.fn(),
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

vi.mock('next/navigation', () => ({
  notFound: mocks.notFoundMock,
  redirect: mocks.redirectMock,
}))

vi.mock('@/utilities/content/serverData', () => ({
  countPublishedPosts: mocks.countPublishedPostsMock,
  findPublishedPostsPage: mocks.findPublishedPostsPageMock,
}))

vi.mock('@/utilities/blog/normalizePost', () => ({
  normalizePost: mocks.normalizePostMock,
}))

vi.mock('@/utilities/generateMeta', () => ({
  createSiteMetadata: mocks.createSiteMetadataMock,
}))

vi.mock('@/app/(frontend)/posts/_components/PostsPagination', () => ({
  PostsPagination: mocks.postsPaginationComponent,
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

    mocks.getPayloadMock.mockResolvedValue({})
    mocks.findPublishedPostsPageMock.mockResolvedValue({
      docs: [{ id: 2, slug: 'page-2-post', title: 'Seite zwei' }],
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

  it('keeps locale-aware queries and pagination paths on deeper paginated pages', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page/[pageNumber]/page')
    const result = await pageModule.default({
      params: Promise.resolve({ pageNumber: '2' }),
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
        page: 2,
      }),
    )
    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 2, slug: 'page-2-post', title: 'Seite zwei' },
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
  })

  it('uses the requested content locale in metadata paths', async () => {
    const pageModule = await import('@/app/(frontend)/posts/page/[pageNumber]/page')

    await pageModule.generateMetadata({
      params: Promise.resolve({ pageNumber: '2' }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.createSiteMetadataMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts/page/2?locale=de',
      }),
    )
  })
})
