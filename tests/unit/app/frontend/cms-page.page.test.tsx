import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  draftModeMock: vi.fn(),
  findPageBySlugMock: vi.fn(),
  findPageSlugsMock: vi.fn(),
  generateMetaMock: vi.fn((args: unknown) => args),
  getPayloadMock: vi.fn(),
  livePreviewListenerComponent: vi.fn(() => null),
  payloadRedirectsComponent: vi.fn(() => null),
  renderBlocksComponent: vi.fn(() => null),
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

vi.mock('@/blocks/RenderBlocks', () => ({
  RenderBlocks: mocks.renderBlocksComponent,
}))

vi.mock('@/components/organisms/LivePreviewListener', () => ({
  LivePreviewListener: mocks.livePreviewListenerComponent,
}))

vi.mock('@/utilities/generateMeta', () => ({
  generateMeta: mocks.generateMetaMock,
}))

vi.mock('@/utilities/content/serverData', () => ({
  findPageBySlug: mocks.findPageBySlugMock,
  findPageSlugs: mocks.findPageSlugsMock,
}))

describe('frontend CMS page route', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    mocks.draftModeMock.mockResolvedValue({ isEnabled: false })
    mocks.getPayloadMock.mockResolvedValue({})
    mocks.findPageBySlugMock.mockResolvedValue({
      slug: 'care/germany',
      meta: {
        title: 'Care in Germany',
      },
      layout: [],
    })
  })

  it('uses the localized page path for metadata', async () => {
    const pageModule = await import('@/app/(frontend)/(pages)/[...slug]/page')

    await pageModule.generateMetadata({
      params: Promise.resolve({ slug: ['care', 'germany'] }),
      searchParams: Promise.resolve({ locale: 'de' }),
    })

    expect(mocks.findPageBySlugMock).toHaveBeenCalledWith({}, 'care/germany', false, {
      locale: 'de',
      fallbackLocale: 'en',
    })
    expect(mocks.generateMetaMock).toHaveBeenCalledWith(
      expect.objectContaining({
        path: '/care/germany?locale=de',
      }),
    )
  })
})
