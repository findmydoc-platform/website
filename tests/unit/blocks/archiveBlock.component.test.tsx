import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  collectionArchiveComponent: vi.fn(() => null),
  findPublishedPostsPageMock: vi.fn(),
  getPayloadMock: vi.fn(),
  normalizePostMock: vi.fn(),
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

vi.mock('@/components/organisms/CollectionArchive', () => ({
  CollectionArchive: mocks.collectionArchiveComponent,
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

describe('ArchiveBlock', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.getPayloadMock.mockResolvedValue({})
    mocks.findPublishedPostsPageMock.mockResolvedValue({
      docs: [{ id: 11, slug: 'hello-world', title: 'Hallo Welt' }],
      totalDocs: 1,
      totalPages: 1,
    })
    mocks.normalizePostMock.mockImplementation((post) => ({
      title: post.title,
      href: `/posts/${post.slug}?locale=de`,
    }))
  })

  it('passes the shared content locale through collection-backed archive queries and card normalization', async () => {
    const { ArchiveBlock } = await import('@/blocks/ArchiveBlock/Component')
    const result = await ArchiveBlock({
      categories: [{ id: 3 }],
      contentLocale: {
        locale: 'de',
        fallbackLocale: 'en',
      },
      populateBy: 'collection',
    } as never)

    expect(mocks.findPublishedPostsPageMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
        pagination: false,
        where: {
          categories: {
            in: [3],
          },
        },
      }),
    )
    expect(mocks.normalizePostMock).toHaveBeenCalledWith(
      { id: 11, slug: 'hello-world', title: 'Hallo Welt' },
      {
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
      },
    )

    const archiveElement = findElementByType(result, mocks.collectionArchiveComponent) as React.ReactElement<{
      posts: Array<{ href: string; title: string }>
    }> | null
    expect(archiveElement?.props.posts).toEqual([
      {
        title: 'Hallo Welt',
        href: '/posts/hello-world?locale=de',
      },
    ])
  })

  it('keeps the same locale propagation for selection-backed archives', async () => {
    mocks.findPublishedPostsPageMock.mockResolvedValueOnce({
      docs: [{ id: 42, slug: 'selected-fetch', title: 'Nachgeladen' }],
      totalDocs: 1,
      totalPages: 1,
    })

    const { ArchiveBlock } = await import('@/blocks/ArchiveBlock/Component')
    const result = await ArchiveBlock({
      contentLocale: {
        locale: 'de',
        fallbackLocale: 'en',
      },
      populateBy: 'selection',
      selectedDocs: [{ value: 42 }, { value: { id: 77, slug: 'selected-post', title: 'Manuell gewahlt' } }],
    } as never)

    expect(mocks.findPublishedPostsPageMock).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        contentLocale: {
          locale: 'de',
          fallbackLocale: 'en',
        },
        limit: 2,
        pagination: false,
        where: {
          id: {
            in: [42, 77],
          },
        },
      }),
    )

    const archiveElement = findElementByType(result, mocks.collectionArchiveComponent) as React.ReactElement<{
      posts: Array<{ href: string; title: string }>
    }> | null
    expect(archiveElement?.props.posts).toEqual([
      {
        title: 'Nachgeladen',
        href: '/posts/selected-fetch?locale=de',
      },
      {
        title: 'Manuell gewahlt',
        href: '/posts/selected-post?locale=de',
      },
    ])
  })
})
