import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  platformInquiryRetentionAnonymizePostHandler,
  platformInquiryLegalHoldPlacePostHandler,
  platformInquiryLegalHoldReleasePostHandler,
  platformInquiryRetentionPackageHardDeletePostHandler,
  platformInquiryRetentionContentHardDeletePostHandler,
  platformInquiryRetentionCutoverPostHandler,
  platformInquiryRetentionPendingDeletesRecoverPostHandler,
  platformInquiryRetentionReviewQueuePostHandler,
} from '@/endpoints/inquiryRetention'

const mocks = vi.hoisted(() => ({
  anonymize: vi.fn(),
  cutover: vi.fn(),
  hardDelete: vi.fn(),
  hardDeletePackage: vi.fn(),
  placeHold: vi.fn(),
  readQueue: vi.fn(),
  recoverPendingDeletes: vi.fn(),
  releaseHold: vi.fn(),
}))

vi.mock('@/features/inquiryRetention/service', () => ({
  anonymizeInquiryPackage: mocks.anonymize,
  cutoverLegacyInquiryCommunication: mocks.cutover,
  hardDeleteInquiryContent: mocks.hardDelete,
  hardDeleteInquiryPackage: mocks.hardDeletePackage,
  placeInquiryLegalHold: mocks.placeHold,
  readInquiryRetentionReviewQueue: mocks.readQueue,
  resumePendingInquiryAttachmentHardDeletes: mocks.recoverPendingDeletes,
  releaseInquiryLegalHold: mocks.releaseHold,
  InquiryRetentionServiceError: class InquiryRetentionServiceError extends Error {},
}))

const request = ({ body, collection = 'platformStaff' }: { body?: unknown; collection?: string | null } = {}) =>
  ({
    context: {},
    headers: new Headers({ 'content-type': 'application/json' }),
    json: vi.fn(async () => body),
    payload: { logger: { error: vi.fn() } },
    searchParams: new URLSearchParams(),
    user: collection ? { collection, id: `${collection}-1` } : undefined,
  }) as unknown as PayloadRequest

describe('inquiry retention endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.cutover.mockResolvedValue({ migrated: 1 })
    mocks.hardDelete.mockResolvedValue({ deleted: true, replayed: false })
    mocks.hardDeletePackage.mockResolvedValue({ deleted: true, replayed: false })
    mocks.placeHold.mockResolvedValue({ holdId: 'hold-1' })
    mocks.readQueue.mockResolvedValue({ items: [] })
    mocks.recoverPendingDeletes.mockResolvedValue({ examined: 0, failed: 0, finalized: 0 })
    mocks.releaseHold.mockResolvedValue({ released: true })
  })

  it.each([
    ['unauthenticated', null, 401],
    ['patient', 'patients', 403],
    ['clinic staff', 'clinicStaff', 403],
  ])('authorizes %s before parsing retention input', async (_label, collection, status) => {
    const req = request({ body: { actorId: 'injected' }, collection })
    const response = await platformInquiryRetentionReviewQueuePostHandler(req)

    expect(response.status).toBe(status)
    expect(req.json).not.toHaveBeenCalled()
    expect(mocks.readQueue).not.toHaveBeenCalled()
  })

  it('accepts a bounded review queue request and returns private-live headers', async () => {
    const req = request({ body: { cursor: 'opaque_1', limit: 25, now: '2026-08-24T12:00:00.000Z' } })
    const response = await platformInquiryRetentionReviewQueuePostHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.readQueue).toHaveBeenCalledWith(req, {
      cursor: 'opaque_1',
      limit: 25,
      now: '2026-08-24T12:00:00.000Z',
    })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, Cookie')
  })

  it('rejects browser-controlled scope and an unbounded cutover before domain access', async () => {
    const injected = await platformInquiryRetentionCutoverPostHandler(
      request({ body: { actorId: 'platform-2', limit: 10 } }),
    )
    const unbounded = await platformInquiryRetentionCutoverPostHandler(request({ body: { limit: 101 } }))

    expect(injected.status).toBe(400)
    expect(unbounded.status).toBe(400)
    expect(mocks.cutover).not.toHaveBeenCalled()
  })

  it('places and releases a case-specific legal hold through strict inputs', async () => {
    const placeReq = request({
      body: {
        reasonCategory: 'regulatory-review',
        responsibleFunction: 'data-protection',
        reviewAt: '2027-01-01T00:00:00.000Z',
        targetId: 'inquiry-1',
        targetType: 'inquiry',
      },
    })
    const placed = await platformInquiryLegalHoldPlacePostHandler(placeReq)
    expect(placed.status).toBe(200)
    expect(mocks.placeHold).toHaveBeenCalledOnce()

    const releaseReq = request({ body: { holdId: 'hold-1' } })
    const released = await platformInquiryLegalHoldReleasePostHandler(releaseReq)
    expect(released.status).toBe(200)
    expect(mocks.releaseHold).toHaveBeenCalledWith(releaseReq, { holdId: 'hold-1' })
  })

  it('hard deletes only an explicitly scoped message or attachment', async () => {
    const body = {
      inquiryId: 'inquiry-1',
      reasonCategory: 'authorized-erasure' as const,
      targetId: 'message-1',
      targetType: 'message' as const,
    }
    const req = request({ body })
    const response = await platformInquiryRetentionContentHardDeletePostHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.hardDelete).toHaveBeenCalledWith(
      req,
      {
        inquiryId: 'inquiry-1',
        reasonCategory: 'authorized-erasure',
        targetId: 'message-1',
        targetType: 'message',
      },
      expect.objectContaining({ deleteObjects: expect.any(Function) }),
    )

    const injected = await platformInquiryRetentionContentHardDeletePostHandler(
      request({ body: { ...body, actorId: 'spoofed' } }),
    )
    expect(injected.status).toBe(400)
    expect(mocks.hardDelete).toHaveBeenCalledTimes(1)
  })

  it('anonymizes or hard deletes one inquiry package through strict operator-only inputs', async () => {
    const body = { inquiryId: 'inquiry-1', reasonCategory: 'authorized-erasure' as const }
    const anonymizeReq = request({ body })
    const anonymized = await platformInquiryRetentionAnonymizePostHandler(anonymizeReq)

    expect(anonymized.status).toBe(200)
    expect(mocks.anonymize).toHaveBeenCalledWith(anonymizeReq, body)

    const deleteReq = request({ body })
    const deleted = await platformInquiryRetentionPackageHardDeletePostHandler(deleteReq)
    expect(deleted.status).toBe(200)
    expect(mocks.hardDeletePackage).toHaveBeenCalledWith(
      deleteReq,
      body,
      expect.objectContaining({ deleteObjects: expect.any(Function) }),
    )

    const injected = await platformInquiryRetentionAnonymizePostHandler(
      request({ body: { ...body, patientId: 'spoofed' } }),
    )
    expect(injected.status).toBe(400)
    expect(mocks.anonymize).toHaveBeenCalledTimes(1)
  })

  it('runs a bounded cursor-based pending-delete recovery command', async () => {
    const req = request({ body: { cursor: 'opaque_1', limit: 25 } })
    const response = await platformInquiryRetentionPendingDeletesRecoverPostHandler(req)

    expect(response.status).toBe(200)
    expect(mocks.recoverPendingDeletes).toHaveBeenCalledWith(
      req,
      { cursor: 'opaque_1', limit: 25 },
      expect.objectContaining({ deleteObjects: expect.any(Function) }),
    )
    expect(response.headers.get('cache-control')).toBe('private, no-store')

    const injected = await platformInquiryRetentionPendingDeletesRecoverPostHandler(
      request({ body: { actorId: 'spoofed', limit: 25 } }),
    )
    expect(injected.status).toBe(400)
    expect(mocks.recoverPendingDeletes).toHaveBeenCalledTimes(1)
  })
})
mocks.anonymize.mockResolvedValue({ anonymized: true, replayed: false })
