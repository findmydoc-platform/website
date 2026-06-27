import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'

import {
  revalidateDeletedPlatformContentMediaConsumers,
  revalidatePlatformContentMediaConsumers,
} from '@/hooks/media/revalidateMediaConsumers'

const cacheMocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

vi.mock('next/cache.js', () => ({
  revalidatePath: cacheMocks.revalidatePath,
  revalidateTag: cacheMocks.revalidateTag,
}))

const collection = {
  slug: 'platformContentMedia',
} as SanitizedCollectionConfig

function createReq(context: Record<string, unknown> = {}): PayloadRequest {
  return {
    context,
    payload: {
      count: vi.fn().mockResolvedValue({ totalDocs: 25 }),
      find: vi.fn().mockImplementation(({ collection: slug, page = 1 }) => {
        if (slug === 'pages') {
          return Promise.resolve({
            docs: page === 1 ? [{ slug: 'home' }] : [{ slug: 'contact' }],
            hasNextPage: page === 1,
          })
        }

        return Promise.resolve({
          docs: page === 1 ? [{ slug: 'first-post' }] : [{ slug: 'second-post' }],
          hasNextPage: page === 1,
        })
      }),
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
      },
    },
  } as unknown as PayloadRequest
}

describe('revalidatePlatformContentMediaConsumers', () => {
  beforeEach(() => {
    cacheMocks.revalidatePath.mockReset()
    cacheMocks.revalidateTag.mockReset()
  })

  it('revalidates cached platform media consumers after platform media changes', async () => {
    const req = createReq()

    await revalidatePlatformContentMediaConsumers({
      collection,
      context: req.context,
      doc: { id: 1 },
      operation: 'update',
      previousDoc: { id: 1 },
      req,
    } as never)

    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('global_landingPages', { expire: 0 })
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('pages-sitemap', { expire: 0 })
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/about')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/partners/clinics')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/contact')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/first-post')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/second-post')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/page/2')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/page/3')
    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('posts-sitemap', { expire: 0 })
    expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages' }))
    expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts' }))
    expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'pages', page: 2 }))
    expect(req.payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts', page: 2 }))
    expect(req.payload.count).toHaveBeenCalledWith(expect.objectContaining({ collection: 'posts' }))
  })

  it('revalidates cached platform media consumers after platform media deletes', async () => {
    const req = createReq()

    await revalidateDeletedPlatformContentMediaConsumers({
      collection,
      context: req.context,
      doc: { id: 1 },
      req,
    } as never)

    expect(cacheMocks.revalidateTag).toHaveBeenCalledWith('global_landingPages', { expire: 0 })
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/first-post')
    expect(cacheMocks.revalidatePath).toHaveBeenCalledWith('/posts/page/3')
  })

  it('skips revalidation when seed batching disables it', async () => {
    const req = createReq({ disableRevalidate: true })

    await revalidatePlatformContentMediaConsumers({
      collection,
      context: req.context,
      doc: { id: 1 },
      operation: 'update',
      previousDoc: { id: 1 },
      req,
    } as never)

    expect(cacheMocks.revalidateTag).not.toHaveBeenCalled()
    expect(cacheMocks.revalidatePath).not.toHaveBeenCalled()
    expect(req.payload.find).not.toHaveBeenCalled()
    expect(req.payload.count).not.toHaveBeenCalled()
  })
})
