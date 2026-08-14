import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import type { Review, ReviewAppeal, ReviewResponse } from '@/payload-types'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import {
  asClinicScopedPayloadUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

describe('reviewAppeals lifecycle', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviewAppeals.lifecycle.test.ts')
  const appealIds: Array<number | string> = []
  const responseIds: Array<number | string> = []
  const reviewIds: Array<number | string> = []
  const staffIds: Array<number | string> = []
  const patientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const [cities, treatments] = await Promise.all([
      payload.find({ collection: 'cities', limit: 1, overrideAccess: true }),
      payload.find({ collection: 'treatments', limit: 1, overrideAccess: true }),
    ])
    cityId = cities.docs[0]?.id as number
    treatmentId = treatments.docs[0]?.id as number
  }, 60000)

  afterEach(async () => {
    while (responseIds.length) {
      const id = responseIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviewResponses', id, overrideAccess: true })
      } catch {}
    }
    while (appealIds.length) {
      const id = appealIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviewAppeals', id, overrideAccess: true })
      } catch {}
    }
    while (reviewIds.length) {
      const id = reviewIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviews', id, overrideAccess: true })
      } catch {}
    }
    await cleanupTrackedUsers(payload, { staffIds, patientIds })
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  async function createApprovedReview(suffix: string) {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-${suffix}`,
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-${suffix}-patient`,
      createdPatientIds: patientIds,
    })
    const review = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: `Approved appeal review for ${suffix}`,
        status: 'approved',
      } as unknown as Review,
      overrideAccess: true,
      depth: 0,
    })
    reviewIds.push(review.id)
    return { clinic, review }
  }

  it('enforces a single immutable appeal and platform-only lifecycle transitions', async () => {
    const { clinic, review } = await createApprovedReview('dismissed')
    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-dismissed-clinic`,
      createdStaffIds: staffIds,
    })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-dismissed-platform`,
      createdStaffIds: staffIds,
    })

    const appeal = await payload.create({
      collection: 'reviewAppeals',
      data: {
        review: review.id,
        reason: 'incorrect_clinic',
        details: 'The clinic believes the patient selected a different location with a similar name.',
      } as unknown as ReviewAppeal,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    appealIds.push(appeal.id)
    expect(appeal.status).toBe('submitted')

    await expect(
      payload.create({
        collection: 'reviewAppeals',
        data: {
          review: review.id,
          reason: 'other',
          details: 'A second appeal must never be created for the same patient review.',
        } as unknown as ReviewAppeal,
        user: clinicUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        data: { details: 'Clinic edit after submission is not permitted.' } as unknown as ReviewAppeal,
        user: clinicUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        data: {
          status: 'upheld',
          decisionReason: 'This direct transition intentionally skips the required review step.',
        } as unknown as ReviewAppeal,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: expect.stringContaining('cannot move'),
            path: 'status',
          }),
        ],
      },
    })

    const underReview = await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      data: { status: 'under_review' } as unknown as ReviewAppeal,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })
    expect(underReview.status).toBe('under_review')

    const dismissed = await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      data: {
        status: 'dismissed',
        decisionReason: 'The review context was verified and the approved patient review remains public.',
      } as unknown as ReviewAppeal,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })
    expect(dismissed.status).toBe('dismissed')

    const stillApproved = await payload.findByID({
      collection: 'reviews',
      id: review.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(stillApproved.status).toBe('approved')

    await expect(
      payload.find({
        collection: 'reviewAppeals',
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    const versions = await payload.findVersions({
      collection: 'reviewAppeals',
      where: { parent: { equals: appeal.id } },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(versions.docs.length).toBeGreaterThanOrEqual(3)

    await expect(
      payload.delete({
        collection: 'reviewAppeals',
        id: appeal.id,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.restoreVersion({
        collection: 'reviewAppeals',
        id: versions.docs[0]!.id,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toThrow('immutable audit records')
  }, 60000)

  it('requires a separate public moderation action before recording an upheld decision', async () => {
    const { clinic, review } = await createApprovedReview('upheld')
    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-upheld-clinic`,
      createdStaffIds: staffIds,
    })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-upheld-platform`,
      createdStaffIds: staffIds,
    })
    const submittedResponse = await payload.create({
      collection: 'reviewResponses',
      data: {
        review: review.id,
        pendingResponse: {
          body: 'Thank you for raising this concern. The clinic has documented the reported privacy issue.',
        },
      } as unknown as ReviewResponse,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    const response = await payload.update({
      collection: 'reviewResponses',
      id: submittedResponse.id,
      data: { moderationStatus: 'approved' } as unknown as ReviewResponse,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })
    responseIds.push(response.id)
    expect(response.moderationStatus).toBe('approved')
    expect(response.publishedResponse?.isBlocked).toBe(false)
    const appeal = await payload.create({
      collection: 'reviewAppeals',
      data: {
        review: review.id,
        reason: 'privacy_concern',
        details: 'The review includes treatment details that identify another patient at the clinic.',
      } as unknown as ReviewAppeal,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    appealIds.push(appeal.id)

    await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      data: { status: 'under_review' } as unknown as ReviewAppeal,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
    })

    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        data: {
          status: 'upheld',
          decisionReason: 'The privacy concern was confirmed but still requires a public moderation action.',
        } as unknown as ReviewAppeal,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: expect.stringContaining('separate public moderation action'),
            path: 'status',
          }),
        ],
      },
    })

    const moderatedAt = new Date(Math.max(Date.now(), Date.parse(appeal.createdAt)) + 1000).toISOString()
    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        publicMeasure: 'none',
        moderationReason: 'The appeal was reviewed and no public change is required.',
        moderatedAt,
        moderatedBy: moderator.id,
      } as unknown as Review,
      user: asPayloadStaffUser(moderator),
      overrideAccess: true,
      depth: 0,
    })

    const reviewVersionsBeforeDecision = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    const responseVersionsBeforeDecision = await payload.findVersions({
      collection: 'reviewResponses',
      where: { parent: { equals: response.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })

    await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      data: {
        status: 'upheld',
        decisionReason: 'The privacy concern was confirmed and requires a separate moderation decision.',
      } as unknown as ReviewAppeal,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
    })

    const internalReview = await payload.findByID({
      collection: 'reviews',
      id: review.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(internalReview).toMatchObject({
      status: 'approved',
      starRating: 4,
      comment: 'Approved appeal review for upheld',
    })

    const internalResponse = await payload.findByID({
      collection: 'reviewResponses',
      id: response.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(internalResponse.moderationStatus).toBe('approved')
    expect(internalResponse.publishedResponse).toMatchObject({
      body: 'Thank you for raising this concern. The clinic has documented the reported privacy issue.',
      isBlocked: false,
    })
    expect(internalResponse.moderationReason).toBeNull()
    expect(internalResponse.lastAction).toBe('approved')
    expect(internalResponse.lastActorType).toBe('platform_staff')

    const clinicAppeal = await payload.findByID({
      collection: 'reviewAppeals',
      id: appeal.id,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(clinicAppeal).toMatchObject({
      status: 'upheld',
      decisionReason: 'The privacy concern was confirmed and requires a separate moderation decision.',
    })
    await expect(
      payload.find({
        collection: 'reviewAppeals',
        where: { id: { equals: appeal.id } },
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow()

    const publicReviews = await payload.find({
      collection: 'reviews',
      where: { id: { equals: review.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicReviews.docs).toHaveLength(1)
    expect(publicReviews.docs[0]).toMatchObject({
      status: 'approved',
      starRating: 4,
      comment: 'Approved appeal review for upheld',
    })

    const publicResponses = await payload.find({
      collection: 'reviewResponses',
      where: { id: { equals: response.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicResponses.docs).toHaveLength(1)
    expect(publicResponses.docs[0]?.publishedResponse).toMatchObject({
      body: 'Thank you for raising this concern. The clinic has documented the reported privacy issue.',
      isBlocked: false,
    })

    const reviewVersionsAfterDecision = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    const responseVersionsAfterDecision = await payload.findVersions({
      collection: 'reviewResponses',
      where: { parent: { equals: response.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    expect(reviewVersionsAfterDecision.docs).toHaveLength(reviewVersionsBeforeDecision.docs.length)
    expect(responseVersionsAfterDecision.docs).toHaveLength(responseVersionsBeforeDecision.docs.length)
  }, 60000)

  it('requires an audited review moderation before a trusted upheld snapshot', async () => {
    const appealCreatedAt = '2026-01-24T09:00:00.000Z'
    const moderatedAt = '2026-01-24T09:30:00.000Z'
    const decidedAt = '2026-01-24T10:00:00.000Z'
    const { review } = await createApprovedReview('trusted-upheld')
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-trusted-upheld-platform`,
      createdStaffIds: staffIds,
    })
    const platformUser = asPayloadStaffUser(moderator)
    const appeal = await payload.create({
      collection: 'reviewAppeals',
      data: {
        review: review.id,
        reason: 'privacy_concern',
        details: 'The clinic reports privacy-sensitive details that could identify another patient.',
        status: 'submitted',
        createdAt: appealCreatedAt,
      } as unknown as ReviewAppeal,
      user: platformUser,
      overrideAccess: true,
      context: { trustedReviewWorkflowSeed: true },
      depth: 0,
    })
    appealIds.push(appeal.id)
    expect(appeal.createdAt).toBe(appealCreatedAt)

    const finalSnapshot = {
      status: 'upheld',
      decisionReason: 'The privacy concern was confirmed after the separate public moderation action.',
      decidedAt,
    } as unknown as ReviewAppeal

    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        data: finalSnapshot,
        user: platformUser,
        overrideAccess: true,
        context: { trustedReviewWorkflowSeed: true },
        depth: 0,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: expect.stringContaining('separate public moderation action'),
            path: 'status',
          }),
        ],
      },
    })

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        publicMeasure: 'removed',
        publicComment: null,
        publicNotice: null,
        moderationReason: 'The review contains privacy-sensitive details that could identify another patient.',
        moderatedAt: appealCreatedAt,
        moderatedBy: moderator.id,
      } as unknown as Review,
      user: platformUser,
      overrideAccess: true,
      depth: 0,
    })

    await expect(
      payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        data: finalSnapshot,
        user: platformUser,
        overrideAccess: true,
        context: { trustedReviewWorkflowSeed: true },
        depth: 0,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: expect.stringContaining('recorded after submission'),
            path: 'status',
          }),
        ],
      },
    })

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        publicMeasure: 'removed',
        publicComment: null,
        publicNotice: null,
        moderationReason: 'The review contains privacy-sensitive details that could identify another patient.',
        moderatedAt,
        moderatedBy: moderator.id,
      } as unknown as Review,
      user: platformUser,
      overrideAccess: true,
      depth: 0,
    })

    const reviewVersions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(reviewVersions.docs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          version: expect.objectContaining({
            publicMeasure: 'removed',
            moderatedAt,
            moderatedBy: moderator.id,
          }),
        }),
      ]),
    )

    const upheld = await payload.update({
      collection: 'reviewAppeals',
      id: appeal.id,
      data: finalSnapshot,
      user: platformUser,
      overrideAccess: true,
      context: { trustedReviewWorkflowSeed: true },
      depth: 0,
    })

    expect(upheld).toMatchObject({
      status: 'upheld',
      decidedAt,
    })
    expect(Date.parse(appeal.createdAt)).toBeLessThan(Date.parse(moderatedAt))
    expect(Date.parse(moderatedAt)).toBeLessThan(Date.parse(upheld.decidedAt!))
  }, 60000)
})
