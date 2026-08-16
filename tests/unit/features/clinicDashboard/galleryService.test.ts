import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readClinicGallerySnapshot, saveClinicGallery } from '@/features/clinicDashboard/gallery/service'

const dispatchClinicGalleryChangeRevalidation = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/revalidateClinicSurfaces', () => ({ dispatchClinicGalleryChangeRevalidation }))

const clinic = {
  id: 42,
  name: 'Clinic',
  profileGallery: [],
  profileRevision: 3,
  slug: 'clinic',
  status: 'approved',
  thumbnail: null,
}

const buildRequest = () => {
  const db = {
    beginTransaction: vi.fn().mockResolvedValue('tx-1'),
    commitTransaction: vi.fn().mockResolvedValue(undefined),
    rollbackTransaction: vi.fn().mockResolvedValue(undefined),
  }
  const payload = {
    db,
    findByID: vi.fn().mockResolvedValue({ ...clinic }),
    find: vi.fn().mockResolvedValue({ docs: [] }),
    update: vi.fn().mockResolvedValue({ docs: [{ ...clinic, profileRevision: 4 }] }),
    logger: { error: vi.fn() },
  }
  return { db, payload, req: { context: {}, payload } as unknown as PayloadRequest }
}

describe('clinic gallery save transaction', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the stable conflict and rolls back a stale revision without writes', async () => {
    const { db, payload, req } = buildRequest()

    await expect(saveClinicGallery(req, 42, { expectedRevision: 2, items: [] })).rejects.toMatchObject({
      kind: 'conflict',
    })

    expect(payload.update).not.toHaveBeenCalled()
    expect(db.rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(db.commitTransaction).not.toHaveBeenCalled()
  })

  it('rolls back the complete transaction when a media update fails', async () => {
    const { db, payload, req } = buildRequest()
    payload.find.mockResolvedValue({
      docs: [{ id: 9, clinic: 42, status: 'draft', alt: null, caption: null }],
    })
    payload.update.mockRejectedValueOnce(new Error('media write failed'))

    await expect(
      saveClinicGallery(req, 42, {
        expectedRevision: 3,
        items: [{ mediaId: '9', alt: 'Clinic reception' }],
      }),
    ).rejects.toThrow('media write failed')

    expect(db.rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(db.commitTransaction).not.toHaveBeenCalled()
    expect(dispatchClinicGalleryChangeRevalidation).not.toHaveBeenCalled()
  })

  it('retries one serializable conflict and emits one post-commit cache event', async () => {
    const { db, payload, req } = buildRequest()
    db.beginTransaction.mockResolvedValueOnce('tx-1').mockResolvedValueOnce('tx-2')
    payload.findByID
      .mockRejectedValueOnce(Object.assign(new Error('serialization failure'), { code: '40001' }))
      .mockResolvedValue({ ...clinic })

    const result = await saveClinicGallery(req, 42, { expectedRevision: 3, items: [] })

    expect(result.snapshot.revision).toBe(4)
    expect(db.rollbackTransaction).toHaveBeenCalledWith('tx-1')
    expect(db.commitTransaction).toHaveBeenCalledWith('tx-2')
    expect(dispatchClinicGalleryChangeRevalidation).toHaveBeenCalledOnce()
  })

  it('marks changed main-image metadata as listing-relevant and returns the committed snapshot', async () => {
    const { payload, req } = buildRequest()
    payload.findByID.mockResolvedValue({ ...clinic, profileGallery: [9], thumbnail: 9 })
    payload.find.mockResolvedValue({
      docs: [
        {
          alt: 'Old reception description',
          caption: null,
          clinic: 42,
          filename: 'reception.jpg',
          id: 9,
          status: 'published',
          updatedAt: '2026-08-14T10:00:00.000Z',
          url: '/api/clinicMedia/file/reception.jpg',
        },
      ],
    })
    payload.update.mockImplementation(async (args: { collection: string }) =>
      args.collection === 'clinicMedia'
        ? {
            alt: 'Clear reception description',
            caption: null,
            clinic: 42,
            filename: 'reception.jpg',
            id: 9,
            status: 'published',
            updatedAt: '2026-08-14T10:05:00.000Z',
            url: '/api/clinicMedia/file/reception.jpg',
          }
        : { docs: [{ ...clinic, profileGallery: [9], profileRevision: 4, thumbnail: 9 }] },
    )

    const result = await saveClinicGallery(req, 42, {
      expectedRevision: 3,
      items: [{ mediaId: '9', alt: 'Clear reception description' }],
    })

    expect(result.snapshot).toMatchObject({
      items: [{ alt: 'Clear reception description', id: '9', status: 'published' }],
      revision: 4,
    })
    expect(payload.findByID).toHaveBeenCalledOnce()
    expect(dispatchClinicGalleryChangeRevalidation).toHaveBeenCalledWith(
      expect.objectContaining({ mainImageChanged: true }),
    )
  })
})

describe('clinic gallery snapshot', () => {
  it('only returns draft cleanup candidates after the abandonment threshold', async () => {
    const { payload, req } = buildRequest()
    payload.find.mockResolvedValue({ docs: [] })

    await readClinicGallerySnapshot(req, 42)

    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          and: [
            { clinic: { equals: 42 } },
            { status: { equals: 'draft' } },
            { createdAt: { less_than: expect.any(String) } },
          ],
        },
      }),
    )
  })

  it('returns absolute media URLs for the dashboard contract', async () => {
    const { payload, req } = buildRequest()
    payload.findByID.mockResolvedValue({ ...clinic, profileGallery: [9] })
    payload.find.mockImplementation(async (args: unknown) => {
      const serialized = JSON.stringify(args)
      if (serialized.includes('published')) {
        return {
          docs: [
            {
              alt: 'Clinic reception',
              clinic: 42,
              filename: 'clinic-reception.jpg',
              id: 9,
              sizes: {
                thumbnail: {
                  filename: 'clinic-reception-300x188.jpg',
                  url: '/api/clinicMedia/file/clinic-reception-300x188.jpg',
                },
              },
              status: 'published',
              updatedAt: '2026-08-14T10:00:00.000Z',
              url: '/api/clinicMedia/file/clinic-reception.jpg',
            },
          ],
        }
      }
      return { docs: [] }
    })

    const result = await readClinicGallerySnapshot(req, 42)

    expect(() => new URL(result.snapshot.items[0]?.url ?? '')).not.toThrow()
    expect(() => new URL(result.snapshot.items[0]?.thumbnailUrl ?? '')).not.toThrow()
  })
})
