import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCachedPostArchivePageMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('notFound')
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('next-intl/server', () => ({ getTranslations: async () => () => 'Translation fixture' }))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFoundMock,
  redirect: mocks.redirectMock,
}))

vi.mock('@/utilities/content/serverData', () => ({
  getCachedPostArchivePage: mocks.getCachedPostArchivePageMock,
}))

describe('Paginated posts page route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const getModule = async () => import('@/app/(frontend)/posts/page/[pageNumber]/page')

  it('redirects page 1 to canonical /posts', async () => {
    const pageModule = await getModule()

    await expect(
      pageModule.default({
        params: Promise.resolve({ pageNumber: '1' }),
      }),
    ).rejects.toThrow('redirect:/posts')

    expect(mocks.redirectMock).toHaveBeenCalledWith('/posts')
    expect(mocks.getCachedPostArchivePageMock).not.toHaveBeenCalled()
  })

  it('redirects English page 1 to the English archive', async () => {
    const route = await import('@/app/(frontend)/en/posts/page/[pageNumber]/page')

    await expect(route.default({ params: Promise.resolve({ pageNumber: '1' }) })).rejects.toThrow('redirect:/en/posts')
    expect(mocks.getCachedPostArchivePageMock).not.toHaveBeenCalled()
  })

  it('returns notFound for non-numeric page params', async () => {
    const pageModule = await getModule()

    await expect(
      pageModule.default({
        params: Promise.resolve({ pageNumber: 'abc' }),
      }),
    ).rejects.toThrow('notFound')

    expect(mocks.notFoundMock).toHaveBeenCalled()
    expect(mocks.getCachedPostArchivePageMock).not.toHaveBeenCalled()
  })

  it('returns notFound for page 0 and skips the archive lookup', async () => {
    const pageModule = await getModule()

    await expect(
      pageModule.default({
        params: Promise.resolve({ pageNumber: '0' }),
      }),
    ).rejects.toThrow('notFound')

    expect(mocks.notFoundMock).toHaveBeenCalled()
    expect(mocks.getCachedPostArchivePageMock).not.toHaveBeenCalled()
  })

  it('returns notFound for out-of-range pages', async () => {
    mocks.getCachedPostArchivePageMock.mockResolvedValueOnce({
      docs: [],
      totalPages: 2,
      totalDocs: 24,
      page: 3,
    })

    const pageModule = await getModule()

    await expect(
      pageModule.default({
        params: Promise.resolve({ pageNumber: '3' }),
      }),
    ).rejects.toThrow('notFound')

    expect(mocks.getCachedPostArchivePageMock).toHaveBeenCalled()
    expect(mocks.notFoundMock).toHaveBeenCalled()
  })
})
