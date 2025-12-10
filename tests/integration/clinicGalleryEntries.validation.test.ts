import { describe, it, expect, vi } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import type { ClinicGalleryEntry } from '@/payload-types'
import { beforeChangeClinicGalleryEntry } from '@/collections/ClinicGalleryEntries/hooks/beforeChangeClinicGalleryEntry'

describe('clinicGalleryEntries beforeChange hook', () => {
  type HookArgs = Parameters<CollectionBeforeChangeHook<ClinicGalleryEntry>>[0]
  type Request = HookArgs['req']
  type HookData = NonNullable<HookArgs['data']>

  const buildReq = (mediaMap: Record<number, { clinic?: number; status?: string }> = {}) => ({
    payload: {
      findByID: vi.fn(async ({ id }: { id: string | number }) => {
        const media = mediaMap[Number(id)]
        if (!media) {
          throw new Error(`missing media ${id}`)
        }
        return { id: Number(id), ...media }
      }),
    },
  })

  const invokeHook = (args: Partial<HookArgs> & { data?: HookData; req: Request }) =>
    beforeChangeClinicGalleryEntry({
      collection: { slug: 'clinicGalleryEntries' } as HookArgs['collection'],
      context: {},
      data: (args.data ?? {}) as HookData,
      originalDoc: args.originalDoc,
      operation: (args.operation as 'create' | 'update') ?? 'create',
      req: args.req,
    })

  it('requires a clinic relationship before validating media', async () => {
    await expect(
      invokeHook({
        data: { title: 'Missing clinic' },
        req: { payload: { findByID: vi.fn() } } as unknown as Request,
      }),
    ).rejects.toThrow('Clinic is required for gallery entries')
  })

  it('requires both before and after media', async () => {
    await expect(
      invokeHook({
        data: { clinic: 1, beforeMedia: 11 },
        req: { payload: { findByID: vi.fn() } } as unknown as Request,
      }),
    ).rejects.toThrow('Before and after media are required for gallery entries')
  })

  it('normalizes media ids and validates ownership/publication rules', async () => {
    const req = buildReq({
      1: { clinic: 1, status: 'published' },
      2: { clinic: 1, status: 'published' },
    })

    const draft = await invokeHook({
      data: {
        clinic: 1,
        beforeMedia: 1,
        afterMedia: 2,
        status: 'published',
      },
      req: req as unknown as Request,
    })

    expect(draft.beforeMedia).toBe(1)
    expect(draft.afterMedia).toBe(2)
    expect(draft.status).toBe('published')
    expect(req.payload.findByID).toHaveBeenCalledTimes(2)
  })

  it('prevents referencing media from a different clinic', async () => {
    const req = buildReq({
      1: { clinic: 1, status: 'published' },
      2: { clinic: 2, status: 'published' },
    })

    await expect(
      invokeHook({
        data: {
          clinic: 1,
          beforeMedia: 1,
          afterMedia: 2,
        },
        req: req as unknown as Request,
      }),
    ).rejects.toThrow('Gallery entries can only reference media from the same clinic')
  })

  it('requires published media when the entry is published', async () => {
    const req = buildReq({
      1: { clinic: 1, status: 'published' },
      2: { clinic: 1, status: 'draft' },
    })

    await expect(
      invokeHook({
        data: {
          clinic: 1,
          beforeMedia: 1,
          afterMedia: 2,
          status: 'published',
        },
        req: req as unknown as Request,
      }),
    ).rejects.toThrow('Gallery entries can only be published when all referenced media are published')
  })
})
