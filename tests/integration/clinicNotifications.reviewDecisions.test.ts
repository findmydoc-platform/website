import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import type { Review, ReviewAppeal, ReviewResponse } from '@/payload-types'
import config from '@payload-config'
import {
  activateClinicNotificationsForTest,
  markClinicNotificationsRead,
  readClinicNotifications,
} from '@/features/clinicNotifications/service'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@payloadcms/storage-s3', () => ({ s3Storage: () => (incomingConfig: unknown) => incomingConfig }))

describe('native review decisions in the personal clinic notification feed', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number
  let treatmentId: number
  let reader: PayloadRequest
  let clinicWriter: PayloadRequest
  let moderator: PayloadRequest
  let sequence = 0

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    treatmentId = (await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })).docs[0]!.id
    const fixture = await createClinicFixture(payload, city.id, {
      slugPrefix: testSlug('clinicNotifications.reviewDecisions.test.ts'),
    })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    const staff = await createClinicTestUser(payload, {
      emailPrefix: 'review-decision-reader',
      createdStaffIds: [],
    })
    clinicWriter = await createLocalReq({ user: await asClinicScopedPayloadUser(payload, staff, clinicId) }, payload)
    reader = await createLocalReq({ user: clinicWriter.user! }, payload)
    const platform = await createPlatformTestUser(payload, {
      emailPrefix: 'review-decision-moderator',
      createdStaffIds: [],
    })
    moderator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
    await activateClinicNotificationsForTest(await createLocalReq({}, payload))
  }, 60_000)

  afterAll(async () => {
    await payload?.db.destroy?.()
  })

  const newReview = async () => {
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `review-decision-patient-${++sequence}`,
      createdPatientIds: [],
    })
    return payload.create({
      collection: 'reviews',
      req: moderator,
      overrideAccess: true,
      depth: 0,
      data: {
        patient: patient.id,
        clinic: clinicId,
        doctor: doctorId,
        treatment: treatmentId,
        status: 'approved',
        starRating: 5,
        comment: 'Synthetic current review text.',
        authorVisibility: 'anonymous',
      } as Review,
    })
  }

  const decisionEntries = async (reviewId: number) => {
    const response = await readClinicNotifications(await createLocalReq({ user: reader.user! }, payload), {
      mode: 'page',
      view: 'all',
    })
    if (response.mode !== 'page') throw new Error('Expected notification page')
    return response.items.filter(
      (item) =>
        item.members[0]?.sourceRecord.id === String(reviewId) &&
        ['clinic_response_decided', 'review_appeal_decided'].includes(item.members[0].eventType),
    )
  }

  it('captures one approved response decision with durable identity, permitted outcome and personal receipt', async () => {
    const review = await newReview()
    const submitted = await payload.create({
      collection: 'reviewResponses',
      req: clinicWriter,
      overrideAccess: false,
      depth: 0,
      data: {
        review: review.id,
        pendingResponse: { body: 'Thank you for sharing your experience with our clinic.' },
      } as unknown as ReviewResponse,
    })
    expect(await decisionEntries(review.id)).toEqual([])

    const decision = await payload.update({
      collection: 'reviewResponses',
      id: submitted.id,
      req: moderator,
      overrideAccess: false,
      depth: 0,
      data: { moderationStatus: 'approved' } as unknown as ReviewResponse,
    })
    const first = await decisionEntries(review.id)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      destination: { kind: 'review', reviewId: String(review.id) },
      display: { eventLabel: 'Review response decision', outcome: 'approved' },
      members: [
        { eventType: 'clinic_response_decided', sourceOccurrence: { kind: 'response_decision' }, readAt: null },
      ],
    })
    expect(JSON.stringify(first[0])).not.toContain('Thank you for sharing')
    const fact = await payload.find({
      collection: 'reviewDecisionTransitions' as never,
      overrideAccess: true,
      pagination: false,
      where: { reviewId: { equals: String(review.id) } },
    })
    expect(fact.docs).toHaveLength(1)
    expect(fact.docs[0]).toMatchObject({
      transitionId: first[0]!.members[0]!.sourceOccurrence.id,
      eventType: 'clinic_response_decided',
      outcome: 'approved',
      occurredAt: first[0]!.members[0]!.occurredAt,
    })
    expect(first[0]!.members[0]!.occurredAt).toBe(decision.lastActionAt)

    await expect(
      payload.update({
        collection: 'reviewResponses',
        id: submitted.id,
        req: moderator,
        overrideAccess: false,
        data: { moderationStatus: 'approved' } as unknown as ReviewResponse,
      }),
    ).rejects.toThrow()
    expect(await decisionEntries(review.id)).toEqual(first)

    await markClinicNotificationsRead(reader, { notificationIds: [first[0]!.members[0]!.notificationId] })
    const acknowledged = await decisionEntries(review.id)
    expect(acknowledged[0]!.members[0]!.readAt).toEqual(expect.any(String))
    expect(await decisionEntries(review.id)).toEqual(acknowledged)
  }, 60_000)

  it.each(['rejected', 'blocked'] as const)(
    'captures only the terminal %s response decision and omits private moderation details',
    async (outcome) => {
      const review = await newReview()
      const submitted = await payload.create({
        collection: 'reviewResponses',
        req: clinicWriter,
        overrideAccess: false,
        depth: 0,
        data: {
          review: review.id,
          pendingResponse: { body: `Synthetic ${outcome} response awaiting moderation.` },
        } as ReviewResponse,
      })
      expect(await decisionEntries(review.id)).toEqual([])
      const decided = await payload.update({
        collection: 'reviewResponses',
        id: submitted.id,
        req: moderator,
        overrideAccess: false,
        depth: 0,
        data: {
          moderationStatus: outcome,
          moderationReason: `Private ${outcome} moderation reason.`,
        } as ReviewResponse,
      })
      const first = await decisionEntries(review.id)
      expect(first).toHaveLength(1)
      expect(first[0]).toMatchObject({
        destination: { kind: 'review', reviewId: String(review.id) },
        display: { outcome },
        members: [{ eventType: 'clinic_response_decided', outcome }],
      })
      expect(first[0]!.members[0]!.occurredAt).toBe(decided.lastActionAt)
      expect(JSON.stringify(first[0])).not.toContain(`Private ${outcome}`)
      expect(JSON.stringify(first[0])).not.toContain(`Synthetic ${outcome} response`)
      await payload
        .update({
          collection: 'reviewResponses',
          id: submitted.id,
          req: moderator,
          overrideAccess: false,
          data: { moderationStatus: outcome, moderationReason: 'Repeated terminal update.' } as ReviewResponse,
        })
        .catch(() => undefined)
      expect(await decisionEntries(review.id)).toEqual(first)
    },
    60_000,
  )

  it('keeps intermediate appeal work silent and records the final rejected outcome once', async () => {
    const review = await newReview()
    const appeal = await payload.create({
      collection: 'reviewAppeals',
      req: clinicWriter,
      overrideAccess: false,
      depth: 0,
      data: {
        review: review.id,
        reason: 'other',
        details: 'Synthetic appeal details belong only in the review workflow.',
      } as unknown as ReviewAppeal,
    })
    expect(await decisionEntries(review.id)).toEqual([])
    await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'under_review' } as unknown as ReviewAppeal,
    })
    expect(await decisionEntries(review.id)).toEqual([])
    const decided = await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      req: moderator,
      overrideAccess: false,
      data: {
        status: 'dismissed',
        decisionReason: 'The published review remains valid after the appeal decision.',
      } as unknown as ReviewAppeal,
    })
    const first = await decisionEntries(review.id)
    expect(first).toHaveLength(1)
    expect(first[0]).toMatchObject({
      destination: { kind: 'review', reviewId: String(review.id) },
      display: { eventLabel: 'Review appeal decision', outcome: 'rejected' },
      members: [{ eventType: 'review_appeal_decided', sourceOccurrence: { kind: 'review_appeal_decision' } }],
    })
    expect(first[0]!.members[0]!.occurredAt).toBe(decided.lastActionAt)
    expect(JSON.stringify(first[0])).not.toContain('published review remains valid')
    await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      req: moderator,
      overrideAccess: false,
      data: {
        status: 'dismissed',
        decisionReason: 'A repeated no-op decision update is not a new decision.',
      } as unknown as ReviewAppeal,
    })
    expect(await decisionEntries(review.id)).toEqual(first)
  }, 60_000)

  it('keeps an upheld appeal decision separate from the required public review action', async () => {
    const review = await newReview()
    const appeal = await payload.create({
      collection: 'reviewAppeals',
      req: clinicWriter,
      overrideAccess: false,
      depth: 0,
      data: {
        review: review.id,
        reason: 'privacy_concern',
        details: 'Synthetic private appeal content for an upheld decision.',
      } as ReviewAppeal,
    })
    await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'under_review' } as ReviewAppeal,
    })
    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        req: moderator,
        overrideAccess: false,
        data: { status: 'upheld', decisionReason: 'Private decision before public action.' } as ReviewAppeal,
      }),
    ).rejects.toThrow()
    expect(await decisionEntries(review.id)).toEqual([])

    const afterSubmission = new Date(Date.parse(appeal.createdAt) + 1000).toISOString()
    await payload.update({
      collection: 'reviews',
      id: review.id,
      req: moderator,
      overrideAccess: false,
      depth: 0,
      data: {
        status: 'rejected',
        moderatedAt: afterSubmission,
        moderationReason: 'Separate public moderation reason.',
      } as Review,
    })
    const decision = await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      req: moderator,
      overrideAccess: false,
      data: { status: 'upheld', decisionReason: 'Private final appeal reason.' } as ReviewAppeal,
    })
    const decisions = await decisionEntries(review.id)
    expect(decisions).toHaveLength(1)
    expect(decisions[0]).toMatchObject({
      display: { outcome: 'upheld' },
      members: [{ eventType: 'review_appeal_decided', outcome: 'upheld' }],
    })
    expect(decisions[0]!.members[0]!.occurredAt).toBe(decision.lastActionAt)
    const allOccurrences = await payload.find({
      collection: 'clinicNotificationOccurrences',
      overrideAccess: true,
      pagination: false,
      where: { sourceRecordId: { equals: String(review.id) } },
    })
    const publicAction = allOccurrences.docs.find((entry) => entry.eventType === 'review_removed')
    const appealAction = allOccurrences.docs.find((entry) => entry.eventType === 'review_appeal_decided')
    expect(publicAction).toBeDefined()
    expect(appealAction).toBeDefined()
    expect(publicAction!.notificationId).not.toBe(appealAction!.notificationId)
    expect(JSON.stringify(decisions)).not.toContain('Private final appeal reason')
    expect(JSON.stringify(decisions)).not.toContain('Separate public moderation reason')
  }, 60_000)
})
