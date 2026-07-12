import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PayloadRedirects } from '@/app/(frontend)/_components/PayloadRedirects'

const mocks = vi.hoisted(() => ({
  getPayload: vi.fn(),
  notFound: vi.fn(),
  redirect: vi.fn(),
  redirectsLoader: vi.fn(),
}))

vi.mock('@payload-config', () => ({
  default: {},
}))

vi.mock('payload', () => ({
  getPayload: mocks.getPayload,
}))

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  redirect: mocks.redirect,
}))

vi.mock('@/utilities/getRedirects', () => ({
  getCachedRedirects: () => mocks.redirectsLoader,
}))

const buildRedirectError = (destination: string): Error & { destination: string } =>
  Object.assign(new Error('NEXT_REDIRECT'), { destination })

const buildNotFoundError = (): Error & { code: string } => Object.assign(new Error('NEXT_NOT_FOUND'), { code: '404' })

const expectRedirect = async (url: string, destination: string): Promise<void> => {
  await expect(PayloadRedirects({ url })).rejects.toMatchObject({ destination })
  expect(mocks.redirect).toHaveBeenCalledWith(destination)
}

describe('PayloadRedirects', () => {
  beforeEach(() => {
    mocks.getPayload.mockReset()
    mocks.notFound.mockReset()
    mocks.redirect.mockReset()
    mocks.redirectsLoader.mockReset()

    mocks.redirect.mockImplementation((destination: string) => {
      throw buildRedirectError(destination)
    })
    mocks.notFound.mockImplementation(() => {
      throw buildNotFoundError()
    })
  })

  it('redirects custom URL targets without resolving target documents', async () => {
    const findByID = vi.fn()
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/old',
        to: { type: 'custom', url: '/new' },
      },
    ])

    await expectRedirect('/old', '/new')

    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('resolves page references by id through public-safe live reads', async () => {
    const findByID = vi.fn().mockResolvedValue({
      slug: 'about',
      _status: 'published',
      deletedAt: null,
    })
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/legacy-about',
        to: {
          type: 'reference',
          reference: { relationTo: 'pages', value: '12' },
        },
      },
    ])

    await expectRedirect('/legacy-about', '/about')

    expect(findByID).toHaveBeenCalledWith({
      collection: 'pages',
      id: 12,
      depth: 0,
      draft: false,
      overrideAccess: false,
      select: {
        slug: true,
        _status: true,
        deletedAt: true,
      },
    })
  })

  it('normalizes home page references to root only after live resolution', async () => {
    const findByID = vi.fn().mockResolvedValue({
      slug: 'home',
      _status: 'published',
      deletedAt: null,
    })
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/old-home',
        to: {
          type: 'reference',
          reference: { relationTo: 'pages', value: 1 },
        },
      },
    ])

    await expectRedirect('/old-home', '/')
  })

  it('resolves post references to canonical post paths', async () => {
    const findByID = vi.fn().mockResolvedValue({
      slug: 'fresh-post',
      _status: 'published',
      deletedAt: null,
    })
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/legacy-post',
        to: {
          type: 'reference',
          reference: { relationTo: 'posts', value: 42 },
        },
      },
    ])

    await expectRedirect('/legacy-post', '/posts/fresh-post')
  })

  it('does not trust embedded reference object slugs as redirect targets', async () => {
    const findByID = vi.fn().mockResolvedValue({
      slug: 'fresh-target',
      _status: 'published',
      deletedAt: null,
    })
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/stale-target',
        to: {
          type: 'reference',
          reference: {
            relationTo: 'pages',
            value: { id: 18, slug: 'stale-target' },
          },
        },
      },
    ])

    await expectRedirect('/stale-target', '/fresh-target')

    expect(mocks.redirect).not.toHaveBeenCalledWith('/stale-target')
  })

  it.each([
    ['missing target', null],
    ['draft target', { slug: 'draft-page', _status: 'draft', deletedAt: null }],
    ['unpublished target', { slug: 'unpublished-page', _status: null, deletedAt: null }],
    ['deleted target', { slug: 'deleted-page', _status: 'published', deletedAt: '2026-01-01T00:00:00.000Z' }],
    ['slug-less target', { slug: '', _status: 'published', deletedAt: null }],
    ['unsafe target path', { slug: 'nested/post', _status: 'published', deletedAt: null }],
  ])('fails closed for %s', async (_name, target) => {
    const findByID = vi.fn().mockResolvedValue(target)
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/invalid-target',
        to: {
          type: 'reference',
          reference: { relationTo: 'posts', value: 24 },
        },
      },
    ])

    await expect(PayloadRedirects({ disableNotFound: true, url: '/invalid-target' })).resolves.toBeNull()

    expect(mocks.redirect).not.toHaveBeenCalled()
  })

  it('does not convert invalid reference targets into root redirects', async () => {
    const findByID = vi.fn().mockResolvedValue({
      slug: 'nested/post',
      _status: 'published',
      deletedAt: null,
    })
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/invalid-post',
        to: {
          type: 'reference',
          reference: { relationTo: 'posts', value: 24 },
        },
      },
    ])

    await expect(PayloadRedirects({ disableNotFound: true, url: '/invalid-post' })).resolves.toBeNull()

    expect(mocks.redirect).not.toHaveBeenCalledWith('/')
  })

  it('fails closed for unsupported or invalid reference values without target reads', async () => {
    const findByID = vi.fn()
    mocks.getPayload.mockResolvedValue({ findByID })
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/unsupported',
        to: {
          type: 'reference',
          reference: { relationTo: 'clinics', value: 100 },
        },
      },
    ])

    await expect(PayloadRedirects({ disableNotFound: true, url: '/unsupported' })).resolves.toBeNull()

    expect(mocks.getPayload).not.toHaveBeenCalled()
    expect(findByID).not.toHaveBeenCalled()
  })

  it('preserves notFound behavior when no usable redirect target exists', async () => {
    mocks.redirectsLoader.mockResolvedValue([])

    await expect(PayloadRedirects({ url: '/missing' })).rejects.toMatchObject({ code: '404' })

    expect(mocks.notFound).toHaveBeenCalledTimes(1)
  })

  it('does not resolve target documents when no redirect rule matches', async () => {
    mocks.redirectsLoader.mockResolvedValue([
      {
        from: '/other',
        to: { type: 'custom', url: '/new' },
      },
    ])

    await expect(PayloadRedirects({ disableNotFound: true, url: '/missing' })).resolves.toBeNull()

    expect(mocks.getPayload).not.toHaveBeenCalled()
  })
})
