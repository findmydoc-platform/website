import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import type { Review } from '@/payload-types'
import config from '@payload-config'
import {
  activateClinicNotificationsForTest,
  readClinicNotifications,
  markClinicNotificationsRead,
} from '@/features/clinicNotifications/service'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
import {
  reviewModerationPostHandler,
  reviewWithdrawPostHandler,
  reviewWithdrawalCorrectionPostHandler,
} from '@/collections/reviews/endpoints'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createClinicTestUser,
  createPlatformTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('native review transitions to personal authorized notification feed', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let treatmentId: number
  let reader: PayloadRequest
  let moderator: PayloadRequest
  let preactivationReviewId: number
  let reviewSequence = 0
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const treatments = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    treatmentId = treatments.docs[0]!.id
    const fixture = await createClinicFixture(payload, cities.docs[0]!.id, {
      slugPrefix: testSlug('clinicNotifications.reviews.test.ts'),
    })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const staff = await createClinicTestUser(payload, {
      emailPrefix: 'review-notification-reader',
      createdStaffIds: [],
    })
    reader = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, staff, clinicId) }, payload)
    const platform = await createPlatformTestUser(payload, {
      emailPrefix: 'review-notification-moderator',
      createdStaffIds: [],
    })
    moderator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
    preactivationReviewId = (await createReview('approved')).id
    await activateClinicNotificationsForTest(await createLocalReq({}, payload))
  }, 60_000)
  afterAll(async () => {
    await payload?.db.destroy?.()
  })
  const createReview = async (status: 'approved' | 'pending' = 'pending', context?: Record<string, unknown>) => {
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `review-notification-patient-${++reviewSequence}`,
      createdPatientIds: [],
    })
    return payload.create({
      collection: 'reviews',
      req: await createLocalReq({ user: moderator.user!, context }, payload),
      overrideAccess: true,
      depth: 0,
      data: {
        patient: patient.id,
        clinic: clinicId,
        doctor: doctorId,
        treatment: treatmentId,
        status,
        starRating: 5,
        comment: 'Synthetic review text without private detail.',
        authorVisibility: 'anonymous',
      } as Review,
    })
  }
  const entries = async (reviewId: number) => {
    const result = await readClinicNotifications(await createLocalReq({ user: reader.user! }, payload), {
      mode: 'page',
      view: 'all',
    })
    if (result.mode !== 'page') throw new Error('Expected notification page')
    return result.items.filter((item) => item.members[0]?.sourceRecord.id === String(reviewId))
  }
  const endpointReq = async (id: number, body: unknown) => {
    const req = await createLocalReq({ user: moderator.user! }, payload)
    req.routeParams = { id }
    req.json = async () => body
    return req
  }

  it('records first native approval once, preserving immutable source evidence and the first personal receipt', async () => {
    const review = await createReview()
    expect(await entries(review.id)).toEqual([])
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'approved' },
    })
    const first = await entries(review.id)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      display: { eventLabel: 'New review', rating: 5 },
      destination: { kind: 'review', reviewId: String(review.id) },
      members: [{ eventType: 'review_published', sourceOccurrence: { kind: 'review_transition' }, readAt: null }],
    })
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      data: { comment: 'Ordinary edited current permitted text.' },
    })
    expect(await entries(review.id)).toEqual(first)
    const ids = first[0]!.members.map((member) => member.notificationId)
    await markClinicNotificationsRead(reader, { notificationIds: ids })
    const marked = await entries(review.id)
    await markClinicNotificationsRead(reader, { notificationIds: ids })
    expect(await entries(review.id)).toEqual(marked)
    expect(marked[0]?.members[0]?.readAt).toEqual(expect.any(String))
    expect(await readClinicReviewDetail(reader, String(review.id))).toMatchObject({
      id: String(review.id),
      comment: 'Ordinary edited current permitted text.',
    })
  })

  it('captures distinct withdrawal and removal commands but never republishes after correction, reapproval or restore', async () => {
    const review = await createReview('approved')
    expect(await entries(review.id)).toHaveLength(1)
    expect(
      (
        await reviewWithdrawPostHandler(
          await endpointReq(review.id, { reason: 'Synthetic withdrawal for publication notification.' }),
        )
      ).status,
    ).toBe(200)
    expect((await entries(review.id)).map((item) => item.members[0]?.eventType)).toEqual([
      'review_withdrawn',
      'review_published',
    ])
    const withdrawn = await entries(review.id)
    expect(withdrawn.every((item) => !('rating' in item.display) && !('displayName' in item.display))).toBe(true)
    expect(await readClinicReviewDetail(reader, String(review.id))).toMatchObject({ withdrawalState: 'withdrawn' })
    expect(await readClinicReviewDetail(reader, String(review.id))).not.toHaveProperty('comment')
    await reviewWithdrawPostHandler(await endpointReq(review.id, { reason: 'Repeated withdrawal must be ignored.' }))
    expect(await entries(review.id)).toEqual(withdrawn)
    await reviewWithdrawalCorrectionPostHandler(
      await endpointReq(review.id, { reason: 'Synthetic correction restores current public source.' }),
    )
    await reviewModerationPostHandler(
      await endpointReq(review.id, { measure: 'removed', reason: 'Synthetic complete removal.' }),
    )
    const removed = await entries(review.id)
    expect(removed.map((item) => item.members[0]?.eventType)).toEqual([
      'review_removed',
      'review_withdrawn',
      'review_published',
    ])
    await reviewModerationPostHandler(
      await endpointReq(review.id, { measure: 'removed', reason: 'Repeated removal audit must be ignored.' }),
    )
    expect(await entries(review.id)).toEqual(removed)
    await reviewModerationPostHandler(
      await endpointReq(review.id, { measure: 'none', reason: 'Synthetic removal correction.' }),
    )
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'rejected' },
    })
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'approved' },
    })
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: true,
      data: { deletedAt: new Date().toISOString() },
    })
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: true,
      trash: true,
      data: { deletedAt: null },
    })
    expect((await entries(review.id)).filter((item) => item.members[0]?.eventType === 'review_published')).toHaveLength(
      1,
    )
  })
  it('never imports preactivation publication but captures its later real withdrawal with current private projections', async () => {
    expect(await entries(preactivationReviewId)).toEqual([])
    await payload.update({
      collection: 'reviews',
      id: preactivationReviewId,
      req: moderator,
      overrideAccess: false,
      data: { comment: 'An ordinary edit of a preactivation publication.' },
    })
    expect(await entries(preactivationReviewId)).toEqual([])
    await reviewWithdrawPostHandler(
      await endpointReq(preactivationReviewId, { reason: 'A qualifying later author withdrawal.' }),
    )
    expect((await entries(preactivationReviewId)).map((item) => item.members[0]?.eventType)).toEqual([
      'review_withdrawn',
    ])
  })

  it('rolls back native review, immutable version, source fact and occurrence together on capture failure', async () => {
    const review = await createReview()
    const versions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      pagination: false,
    })
    const hooks = payload.collections.clinicNotificationOccurrences.config.hooks
    const previous = hooks.beforeChange
    hooks.beforeChange = [
      ...(previous ?? []),
      () => {
        throw new Error('Synthetic capture failure.')
      },
    ]
    try {
      await expect(
        payload.update({
          collection: 'reviews',
          id: review.id,
          req: moderator,
          overrideAccess: false,
          data: { status: 'approved' },
        }),
      ).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' })
    } finally {
      hooks.beforeChange = previous
    }
    expect(await payload.findByID({ collection: 'reviews', id: review.id, overrideAccess: true })).toMatchObject({
      status: 'pending',
    })
    expect(
      (
        await payload.findVersions({
          collection: 'reviews',
          where: { parent: { equals: review.id } },
          overrideAccess: true,
          pagination: false,
        })
      ).docs,
    ).toEqual(versions.docs)
    expect(
      (
        await payload.find({
          collection: 'reviewPublicationTransitions',
          where: { reviewId: { equals: String(review.id) } },
          overrideAccess: true,
        })
      ).docs,
    ).toEqual([])
    expect(await entries(review.id)).toEqual([])
  })

  it('keeps a permanent removal fact after native source and versions are gone, without forbidden history', async () => {
    const review = await createReview('approved')
    await payload.delete({ collection: 'reviews', id: review.id, req: moderator, overrideAccess: false })
    expect(await readClinicReviewDetail(reader, String(review.id))).toBeNull()
    const feed = await entries(review.id)
    expect(feed.map((item) => item.members[0]?.eventType)).toEqual(['review_removed', 'review_published'])
    expect(feed.every((item) => !('rating' in item.display) && !('displayName' in item.display))).toBe(true)
    const evidence = await payload.find({
      collection: 'reviewPublicationTransitions',
      overrideAccess: true,
      where: { reviewId: { equals: String(review.id) } },
      pagination: false,
    })
    expect(evidence.docs).toHaveLength(2)
    expect(evidence.docs.map((fact) => fact.transitionId).sort()).toEqual(
      feed.map((item) => item.members[0]!.sourceOccurrence.id).sort(),
    )
    expect(
      (
        await payload.findVersions({
          collection: 'reviews',
          where: { parent: { equals: review.id } },
          overrideAccess: true,
        })
      ).docs,
    ).toEqual([])
    await markClinicNotificationsRead(await createLocalReq({ user: reader.user! }, payload), {
      notificationIds: feed.map((item) => item.members[0]!.notificationId),
    })
    expect((await entries(review.id)).every((item) => item.members[0]!.readAt !== null)).toBe(true)
    await expect(
      payload.find({ collection: 'reviewPublicationTransitions', req: reader, overrideAccess: false }),
    ).rejects.toThrow()
  })

  it('serializes native review reassignment with the public acknowledgement authorization decision', async () => {
    const review = await createReview('approved')
    const ids = (await entries(review.id)).flatMap((item) => item.members.map((member) => member.notificationId))
    const cities = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const foreign = await createClinicFixture(payload, cities.docs[0]!.id, {
      slugPrefix: testSlug('review-notification-foreign'),
    })
    let release!: () => void
    let observed!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const reached = new Promise<void>((resolve) => {
      observed = resolve
    })
    const find = payload.find.bind(payload)
    let paused = false
    const probe = vi.spyOn(payload, 'find').mockImplementation(async (args) => {
      const result = await find(args)
      if (!paused && args.collection === 'reviews' && args.req?.context?.clinicNotificationCommand === true) {
        paused = true
        observed()
        await held
      }
      return result
    })
    let settled = false
    let marking: Promise<unknown> | undefined
    let move: Promise<unknown> | undefined
    try {
      marking = markClinicNotificationsRead(await createLocalReq({ user: reader.user! }, payload), {
        notificationIds: ids,
      })
      await reached
      move = payload
        .update({
          collection: 'reviews',
          id: review.id,
          overrideAccess: true,
          context: { skipHooks: true },
          data: { clinic: foreign.clinic.id },
        })
        .finally(() => {
          settled = true
        })
      await new Promise((resolve) => setTimeout(resolve, 150))
      expect(settled).toBe(false)
      release()
      await marking
      await move
    } finally {
      release()
      await Promise.allSettled([marking, move].filter((promise): promise is Promise<unknown> => promise !== undefined))
      probe.mockRestore()
    }
    expect(await entries(review.id)).toEqual([])
  })
  it('does not turn trusted seed snapshots into publication history after activation', async () => {
    const review = await createReview('approved', { trustedReviewWorkflowSeed: true })
    expect(await entries(review.id)).toEqual([])
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      data: { comment: 'Ordinary current edit following an imported snapshot.' },
    })
    expect(await entries(review.id)).toEqual([])
  })
  it('uses positive legacy native publication history and cannot accept caller-supplied first-publication evidence', async () => {
    const hooks = payload.collections.reviews.config.hooks
    const previous = { ...hooks }
    let legacyId!: number
    try {
      // The old application wrote native source/version rows before notification producer hooks existed.
      hooks.beforeChange = previous.beforeChange?.slice(0, -1)
      hooks.beforeOperation = previous.beforeOperation?.slice(0, 1)
      hooks.afterChange = previous.afterChange?.slice(1)
      hooks.beforeDelete = []
      hooks.afterOperation = []
      const legacy = await createReview('approved')
      legacyId = legacy.id
      await payload.update({
        collection: 'reviews',
        id: legacy.id,
        req: moderator,
        overrideAccess: true,
        data: { publicMeasure: 'removed' },
      })
    } finally {
      Object.assign(hooks, previous)
    }
    expect(await entries(legacyId)).toEqual([])
    await payload.update({
      collection: 'reviews',
      id: legacyId,
      req: moderator,
      overrideAccess: true,
      data: { publicMeasure: 'none' },
    })
    expect(await entries(legacyId)).toEqual([])
    const pending = await createReview()
    await payload.update({
      collection: 'reviews',
      id: pending.id,
      req: moderator,
      overrideAccess: true,
      data: {
        notificationPublicationEvidenceAt: '2020-01-01T00:00:00.000Z',
        notificationTransition: [{ id: 'forged', eventType: 'review_published' }],
      },
    })
    await payload.update({
      collection: 'reviews',
      id: pending.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'approved' },
    })
    expect(await entries(pending.id)).toHaveLength(1)
    expect((await entries(pending.id))[0]?.members[0]?.sourceOccurrence.id).not.toBe('forged')
  })

  it('rejects late native success and bulk autocommit after a swallowed transaction failure', async () => {
    const reviews = await Promise.all([createReview(), createReview()])
    const hooks = payload.collections.reviews.config.hooks
    const previous = hooks.afterChange
    let injected = false
    hooks.afterChange = [
      ...(previous ?? []),
      async ({ req, doc }) => {
        if (!injected && reviews.some((review) => review.id === doc.id)) {
          injected = true
          const transactionID = await req.transactionID
          if (typeof transactionID !== 'string' && typeof transactionID !== 'number')
            throw new Error('Expected owned transaction.')
          await payload.db.rollbackTransaction(transactionID)
          delete req.transactionID
        }
        return doc
      },
    ]
    try {
      await expect(
        payload.update({
          collection: 'reviews',
          overrideAccess: true,
          where: { id: { in: reviews.map((review) => review.id) } },
          data: { status: 'approved' },
        }),
      ).rejects.toThrow('transaction')
    } finally {
      hooks.afterChange = previous
    }
    for (const review of reviews) {
      expect((await payload.findByID({ collection: 'reviews', id: review.id, overrideAccess: true })).status).toBe(
        'pending',
      )
      expect(await entries(review.id)).toEqual([])
      expect(
        (
          await payload.find({
            collection: 'reviewPublicationTransitions',
            overrideAccess: true,
            where: { reviewId: { equals: String(review.id) } },
          })
        ).docs,
      ).toEqual([])
    }
  })

  it('serializes simultaneous first approvals and preserves two later event identities even with equal times', async () => {
    const review = await createReview()
    const attempts = await Promise.allSettled(
      [1, 2].map(async () =>
        payload.update({
          collection: 'reviews',
          id: review.id,
          overrideAccess: false,
          req: await createLocalReq({ user: moderator.user! }, payload),
          data: { status: 'approved' },
        }),
      ),
    )
    expect(attempts.some((result) => result.status === 'fulfilled')).toBe(true)
    expect(await entries(review.id)).toHaveLength(1)
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(Date.now())
      await payload.update({
        collection: 'reviews',
        id: review.id,
        overrideAccess: true,
        data: { withdrawalState: 'withdrawn' },
      })
      await payload.update({
        collection: 'reviews',
        id: review.id,
        overrideAccess: true,
        data: { publicMeasure: 'removed' },
      })
    } finally {
      vi.useRealTimers()
    }
    const later = (await entries(review.id)).filter((item) => item.members[0]?.eventType !== 'review_published')
    expect(later).toHaveLength(2)
    expect(new Set(later.map((item) => item.members[0]!.sourceOccurrence.id)).size).toBe(2)
    expect(new Set(later.map((item) => item.members[0]!.occurredAt)).size).toBe(1)
  })
  it('uses trusted persisted facts when native callers select only current text', async () => {
    const review = await createReview()
    const result = await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      select: { comment: true },
      data: { status: 'approved' },
    })
    expect(result).toEqual({ id: review.id, comment: 'Synthetic review text without private detail.' })
    expect(await entries(review.id)).toHaveLength(1)
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      select: { comment: true },
      data: { starRating: 1 },
    })
    expect((await entries(review.id))[0]?.display.rating).toBe(1)
    expect(await entries(review.id)).toHaveLength(1)
    await reviewModerationPostHandler(
      await endpointReq(review.id, {
        measure: 'redaction',
        publicComment: 'Current redacted text only.',
        reason: 'Synthetic narrow text removal.',
      }),
    )
    const detail = await readClinicReviewDetail(
      await createLocalReq({ user: reader.user! }, payload),
      String(review.id),
    )
    expect(detail).toMatchObject({ publicComment: 'Current redacted text only.', starRating: 1 })
    expect(detail).not.toHaveProperty('comment')
    expect(detail).not.toHaveProperty('patient')
    expect(detail).not.toHaveProperty('moderationReason')
  })

  it('captures first visibility for approved-but-never-public source without trusting status alone', async () => {
    const review = await createReview('pending')
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: true,
      data: { status: 'approved', publicMeasure: 'removed' },
    })
    expect(await entries(review.id)).toEqual([])
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: true,
      data: { publicMeasure: 'none' },
    })
    expect((await entries(review.id)).map((item) => item.members[0]?.eventType)).toEqual(['review_published'])
  })

  it('preserves committed occurrence identity after a lost native commit response and source replay', async () => {
    const review = await createReview()
    const commit = payload.db.commitTransaction.bind(payload.db)
    const probe = vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (id) => {
      await commit(id)
      throw new Error('Synthetic lost native commit response.')
    })
    try {
      await expect(
        payload.update({
          collection: 'reviews',
          id: review.id,
          req: moderator,
          overrideAccess: false,
          data: { status: 'approved' },
        }),
      ).rejects.toThrow('Synthetic lost native commit response')
    } finally {
      probe.mockRestore()
    }
    const first = await entries(review.id)
    expect(first).toHaveLength(1)
    await payload.update({
      collection: 'reviews',
      id: review.id,
      overrideAccess: false,
      req: await createLocalReq({ user: moderator.user! }, payload),
      data: { status: 'approved' },
    })
    expect(await entries(review.id)).toEqual(first)
  })
  it('does not report another availability change when permanently deleting an already unavailable source', async () => {
    const review = await createReview('approved')
    await payload.update({
      collection: 'reviews',
      id: review.id,
      overrideAccess: true,
      data: { deletedAt: new Date().toISOString() },
    })
    const before = await entries(review.id)
    expect(before.map((item) => item.members[0]?.eventType)).toEqual(['review_removed', 'review_published'])
    await payload.delete({ collection: 'reviews', id: review.id, overrideAccess: true, trash: true })
    expect(await entries(review.id)).toEqual(before)
  })
})
