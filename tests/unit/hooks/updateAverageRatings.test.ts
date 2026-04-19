import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest, SanitizedCollectionConfig } from 'payload'
import {
  updateAverageRatingsAfterChange,
  updateAverageRatingsAfterDelete,
} from '@/hooks/calculations/updateAverageRatings'

type ReviewDoc = {
  id: string | number
  clinic?: unknown
  doctor?: unknown
  treatment?: unknown
  starRating?: unknown
}

const mockCollection = { slug: 'reviews' } as unknown as SanitizedCollectionConfig

const createReq = () => {
  const payload = {
    find: vi.fn(),
    update: vi.fn(),
    logger: {
      info: vi.fn(),
      error: vi.fn(),
    },
  }

  const req = {
    payload,
    context: {},
  } as unknown as PayloadRequest

  return { payload, req }
}

describe('updateAverageRatings hooks', () => {
  it('updates current and previous related entities after review change', async () => {
    const { payload, req } = createReq()
    payload.find
      .mockResolvedValueOnce({ docs: [{ starRating: 4 }, { starRating: 2 }] })
      .mockResolvedValueOnce({ docs: [{ starRating: 5 }] })
      .mockResolvedValueOnce({ docs: [{ starRating: 1 }, { starRating: 5 }] })
      .mockResolvedValueOnce({ docs: [{ starRating: 3 }] })
      .mockResolvedValueOnce({ docs: [] })
    payload.update.mockResolvedValue({})

    const doc: ReviewDoc = {
      id: 10,
      clinic: { id: 'clinic-new' },
      doctor: 'doctor-new',
      treatment: 301,
    }
    const previousDoc: ReviewDoc = {
      id: 10,
      clinic: 'clinic-old',
      doctor: 'doctor-new',
      treatment: 999,
    }

    const result = await updateAverageRatingsAfterChange({
      collection: mockCollection,
      context: req.context,
      data: {},
      doc,
      operation: 'update',
      previousDoc,
      req,
    })

    expect(result).toBe(doc)
    expect(payload.find).toHaveBeenCalledTimes(5)
    expect(payload.update).toHaveBeenCalledTimes(5)
    expect(payload.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        collection: 'clinics',
        id: 'clinic-new',
        data: { averageRating: 3 },
        context: { skipHooks: true },
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        collection: 'doctors',
        id: 'doctor-new',
        data: { averageRating: 5 },
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        collection: 'treatments',
        id: 301,
        data: { averageRating: 3 },
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        collection: 'clinics',
        id: 'clinic-old',
        data: { averageRating: 3 },
      }),
    )
    expect(payload.update).toHaveBeenNthCalledWith(
      5,
      expect.objectContaining({
        collection: 'treatments',
        id: 999,
        data: { averageRating: null },
      }),
    )
  })

  it('skips all work when the hook context already disabled nested hooks', async () => {
    const { payload, req } = createReq()
    req.context = { skipHooks: true }
    const doc: ReviewDoc = { id: 11, clinic: 'clinic-1' }

    const result = await updateAverageRatingsAfterChange({
      collection: mockCollection,
      context: req.context,
      data: {},
      doc,
      operation: 'update',
      previousDoc: undefined,
      req,
    })

    expect(result).toBe(doc)
    expect(payload.find).not.toHaveBeenCalled()
    expect(payload.update).not.toHaveBeenCalled()
  })

  it('logs and continues when average calculation or update fails', async () => {
    const { payload, req } = createReq()
    payload.find.mockRejectedValueOnce(new Error('find failed')).mockResolvedValueOnce({ docs: [{ starRating: 5 }] })
    payload.update.mockRejectedValueOnce(new Error('update failed'))

    const doc: ReviewDoc = {
      id: 12,
      clinic: 'clinic-err',
      doctor: 'doctor-err',
    }

    await updateAverageRatingsAfterDelete({
      collection: mockCollection,
      context: req.context,
      doc,
      id: 12,
      req,
    })

    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Error calculating average rating for clinics:clinic-err',
    )
    expect(payload.logger.error).toHaveBeenCalledWith(
      expect.any(Error),
      'Error updating clinics:clinic-err average rating',
    )
    expect(payload.update).toHaveBeenCalledTimes(2)
  })
})
