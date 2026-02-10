import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  getPayloadMock: vi.fn(),
  findMock: vi.fn(),
  countMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('notFound')
  }),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`redirect:${path}`)
  }),
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFoundMock,
  redirect: mocks.redirectMock,
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', async (importOriginal) => {
  const actual = await importOriginal<typeof import('payload')>()
  return {
    ...actual,
    getPayload: mocks.getPayloadMock.mockResolvedValue({
      find: mocks.findMock,
      count: mocks.countMock,
    }),
  }
})

describe('Paginated posts page route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const getModule = async () => import('@/app/(frontend)/posts/page/[pageNumber]/page')

  it('redirects page 1 to canonical /posts', async () => {
    const pageModule = await getModule()

    await expect(pageModule.default({ params: Promise.resolve({ pageNumber: '1' }) })).rejects.toThrow(
      'redirect:/posts',
    )

    expect(mocks.redirectMock).toHaveBeenCalledWith('/posts')
    expect(mocks.getPayloadMock).not.toHaveBeenCalled()
    expect(mocks.findMock).not.toHaveBeenCalled()
  })

  it('returns notFound for non-numeric page params', async () => {
    const pageModule = await getModule()

    await expect(pageModule.default({ params: Promise.resolve({ pageNumber: 'abc' }) })).rejects.toThrow('notFound')

    expect(mocks.notFoundMock).toHaveBeenCalled()
    expect(mocks.getPayloadMock).not.toHaveBeenCalled()
    expect(mocks.findMock).not.toHaveBeenCalled()
  })

  it('returns notFound for out-of-range pages', async () => {
    mocks.findMock.mockResolvedValueOnce({
      docs: [],
      totalPages: 2,
      totalDocs: 24,
      page: 3,
    })

    const pageModule = await getModule()

    await expect(pageModule.default({ params: Promise.resolve({ pageNumber: '3' }) })).rejects.toThrow('notFound')

    expect(mocks.findMock).toHaveBeenCalled()
    expect(mocks.notFoundMock).toHaveBeenCalled()
  })

  it('builds static params with page size 12 and skips page 1', async () => {
    mocks.countMock.mockResolvedValueOnce({ totalDocs: 25 })

    const pageModule = await getModule()

    await expect(pageModule.generateStaticParams()).resolves.toEqual([{ pageNumber: '2' }, { pageNumber: '3' }])
  })
})
