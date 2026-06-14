import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  calculateReadTimeMock: vi.fn(() => '5 min read'),
  draftModeMock: vi.fn(),
  findPostBySlugMock: vi.fn(),
  findPostSlugsMock: vi.fn(),
  generateMetaMock: vi.fn((args: unknown) => args),
  getPayloadMock: vi.fn(),
  payloadRedirectsComponent: vi.fn(() => null),
  postHeroComponent: vi.fn(() => null),
  postShareActionBarComponent: vi.fn(() => null),
  relatedPostsComponent: vi.fn(() => null),
  richTextComponent: vi.fn(() => null),
  disclaimerNoticeComponent: vi.fn(() => null),
  resolveMediaImageMock: vi.fn<() => unknown>(() => undefined),
}))

vi.mock('next/headers', () => ({
  draftMode: mocks.draftModeMock,
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

vi.mock('@/app/(frontend)/_components/PayloadRedirects', () => ({
  PayloadRedirects: mocks.payloadRedirectsComponent,
}))

vi.mock('@/components/organisms/Heroes/PostHero', () => ({
  PostHero: mocks.postHeroComponent,
}))

vi.mock('@/app/(frontend)/posts/[slug]/PostShareActionBar', () => ({
  PostShareActionBar: mocks.postShareActionBarComponent,
}))

vi.mock('@/blocks/RelatedPosts/Component', () => ({
  RelatedPosts: mocks.relatedPostsComponent,
}))

vi.mock('@/blocks/_shared/RichText', () => ({
  default: mocks.richTextComponent,
}))

vi.mock('@/components/molecules/DisclaimerNotice', () => ({
  DisclaimerNotice: mocks.disclaimerNoticeComponent,
}))

vi.mock('@/utilities/blog/calculateReadTime', () => ({
  calculateReadTime: mocks.calculateReadTimeMock,
}))

vi.mock('@/utilities/media/resolveMediaImage', () => ({
  resolveMediaImage: mocks.resolveMediaImageMock,
}))

vi.mock('@/utilities/generateMeta', () => ({
  generateMeta: mocks.generateMetaMock,
}))

vi.mock('@/utilities/content/serverData', () => ({
  findPostBySlug: mocks.findPostBySlugMock,
  findPostSlugs: mocks.findPostSlugsMock,
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

describe('frontend post detail route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.draftModeMock.mockResolvedValue({ isEnabled: false })
    mocks.getPayloadMock.mockResolvedValue({})
    mocks.findPostSlugsMock.mockResolvedValue([{ slug: 'hello-world' }])
    mocks.resolveMediaImageMock.mockReturnValue({
      src: '/api/platformContentMedia/file/post-hero.webp',
      alt: 'Hallo Welt',
      sizes: '100vw',
      quality: 75,
    })
    mocks.findPostBySlugMock.mockResolvedValue({
      slug: 'hello-world',
      title: 'Hallo Welt',
      excerpt: 'Deutscher Auszug.',
      heroImage: {
        url: '/api/platformContentMedia/file/post-hero.webp',
        alt: 'Hallo Welt',
      },
      content: {
        root: {
          type: 'root',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      },
      categories: [{ title: 'Dental Care' }],
      populatedAuthors: [{ name: 'Ada' }],
      publishedAt: '2026-01-01T00:00:00.000Z',
      relatedPosts: [{ slug: 'related-post', title: 'Verwandter Beitrag' }],
    })
  })

  it('keeps localized navigation and share paths while redirect matching stays canonical', async () => {
    const pageModule = await import('@/app/(frontend)/posts/[slug]/page')
    const result = await pageModule.default({
      params: Promise.resolve({ slug: 'hello-world' }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.findPostBySlugMock).toHaveBeenCalledWith({}, 'hello-world', false, {
      locale: 'de',
      fallbackLocale: 'en',
    })
    expect(mocks.resolveMediaImageMock).toHaveBeenCalledWith(
      {
        url: '/api/platformContentMedia/file/post-hero.webp',
        alt: 'Hallo Welt',
      },
      {
        fallbackAlt: 'Hallo Welt',
        usage: 'hero',
      },
    )

    const redirectElement = findElementByType(result, mocks.payloadRedirectsComponent) as React.ReactElement<{
      disableNotFound?: boolean
      url: string
    }> | null
    expect(redirectElement?.props.url).toBe('/posts/hello-world')
    expect(redirectElement?.props.disableNotFound).toBe(true)

    const heroElement = findElementByType(result, mocks.postHeroComponent) as React.ReactElement<{
      breadcrumbs: Array<{ href: string; label: string }>
      image?: {
        alt: string
        quality: number
        sizes: string
        src: string
      }
    }> | null
    expect(heroElement?.props.breadcrumbs).toEqual([
      { label: 'Home', href: '/' },
      { label: 'Blog', href: '/posts?locale=de' },
    ])
    expect(heroElement?.props.image).toEqual({
      src: '/api/platformContentMedia/file/post-hero.webp',
      alt: 'Hallo Welt',
      sizes: '100vw',
      quality: 75,
    })

    const shareElement = findElementByType(result, mocks.postShareActionBarComponent) as React.ReactElement<{
      backLink: { href: string; label: string }
      shareUrl: string
    }> | null
    expect(shareElement?.props.backLink).toEqual({
      label: 'Back to Blog',
      href: '/posts?locale=de',
    })
    expect(shareElement?.props.shareUrl).toBe('/posts/hello-world?locale=de')

    const relatedPostsElement = findElementByType(result, mocks.relatedPostsComponent) as React.ReactElement<{
      contentLocale: { fallbackLocale: 'en'; locale: 'de' }
    }> | null
    expect(relatedPostsElement?.props.contentLocale).toEqual({
      locale: 'de',
      fallbackLocale: 'en',
    })

    const richTextElement = findElementByType(result, mocks.richTextComponent)
    expect(richTextElement).toBeNull()

    const disclaimerElement = findElementByType(result, mocks.disclaimerNoticeComponent) as React.ReactElement<{
      copy: string
      routeLabel: string
      variant: string
      standalone: boolean
    }> | null
    expect(disclaimerElement?.props.copy).toBe(
      'This article is for general information only. It is not medical advice.',
    )
    expect(disclaimerElement?.props.routeLabel).toBe('Blog')
    expect(disclaimerElement?.props.variant).toBe('slim-notice-bar')
    expect(disclaimerElement?.props.standalone).toBe(true)
  })

  it('uses the localized post path for metadata', async () => {
    const pageModule = await import('@/app/(frontend)/posts/[slug]/page')

    await pageModule.generateMetadata({
      params: Promise.resolve({ slug: 'hello-world' }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.generateMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/posts/hello-world?locale=de',
      }),
    )
  })
})
