import { describe, it, expect, vi } from 'vitest'
import type { CollectionBeforeChangeHook } from 'payload'
import { beforeChangeClinicGalleryEntry } from '@/collections/ClinicGalleryEntries/hooks/beforeChangeClinicGalleryEntry'

describe('clinicGalleryEntries beforeChange hook', () => {
  const buildReq = (mediaMap: Record<string | number, { clinic?: any; status?: string }> = {}) => ({
    payload: {
      findByID: vi.fn(async ({ id }: { id: string | number }) => {
        const media = mediaMap[id]
        if (!media) {
          throw new Error(`missing media ${id}`)
        }
        return { id, ...media }
      }),
    },
  })

  const invokeHook: (
    args: Partial<Parameters<CollectionBeforeChangeHook<any>>[0]> & { data?: any; req: any },
  ) => ReturnType<typeof beforeChangeClinicGalleryEntry> = (args) =>
    beforeChangeClinicGalleryEntry({
      collection: {} as any,
      context: {} as any,
      data: args.data ?? {},
      originalDoc: args.originalDoc,
      operation: (args.operation as 'create' | 'update') ?? 'create',
      req: args.req,
    })

  it('requires a clinic relationship before validating media', async () => {
    await expect(
      invokeHook({
        data: { title: 'Missing clinic' },
        req: { payload: { findByID: vi.fn() } } as any,
      }),
    ).rejects.toThrow('Clinic is required for gallery entries')
  })

  it('requires both before and after media', async () => {
    await expect(
      invokeHook({
        data: { clinic: '1', beforeMedia: 'media-1' },
        req: { payload: { findByID: vi.fn() } } as any,
      }),
    ).rejects.toThrow('Before and after media are required for gallery entries')
  })

  it('normalizes media ids and validates ownership/publication rules', async () => {
    const req = buildReq({
      'media-1': { clinic: 'clinic-1', status: 'published' },
      'media-2': { clinic: 'clinic-1', status: 'published' },
    })

    const draft = await invokeHook({
      data: {
        clinic: 'clinic-1',
        beforeMedia: { relationTo: 'clinicGalleryMedia', value: 'media-1' },
        afterMedia: { relationTo: 'clinicGalleryMedia', value: 'media-2' },
        status: 'published',
      },
      req: req as any,
    })

    expect(draft.beforeMedia).toBe('media-1')
    expect(draft.afterMedia).toBe('media-2')
    expect(draft.status).toBe('published')
    expect(req.payload.findByID).toHaveBeenCalledTimes(2)
  })

  it('prevents referencing media from a different clinic', async () => {
    const req = buildReq({
      'media-1': { clinic: 'clinic-1', status: 'published' },
      'media-2': { clinic: 'clinic-2', status: 'published' },
    })

    await expect(
      invokeHook({
        data: {
          clinic: 'clinic-1',
          beforeMedia: 'media-1',
          afterMedia: 'media-2',
        },
        req: req as any,
      }),
    ).rejects.toThrow('Gallery entries can only reference media from the same clinic')
  })

  it('requires published media when the entry is published', async () => {
    const req = buildReq({
      'media-1': { clinic: 'clinic-1', status: 'published' },
      'media-2': { clinic: 'clinic-1', status: 'draft' },
    })

    await expect(
      invokeHook({
        data: {
          clinic: 'clinic-1',
          beforeMedia: 'media-1',
          afterMedia: 'media-2',
          status: 'published',
        },
        req: req as any,
      }),
    ).rejects.toThrow('Gallery entries can only be published when all referenced media are published')
  })
})
