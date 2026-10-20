import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { asPayloadStaffUser, createPatientTestUser, createPlatformTestUser } from '../tests/fixtures/testUsers'
import type { ClinicStaff, Review, ReviewAppeal, ReviewResponse } from '../src/payload-types'

/** Synthetic native source commands for the isolated two-application acceptance lane. */
export function createReviewDecisionControl(input: {
  payload: Payload
  clinicId: number
  doctorId: number
  clinicStaff: ClinicStaff
}) {
  const { payload, clinicId, doctorId, clinicStaff } = input
  let sequence = 0
  let writer: PayloadRequest | undefined
  let moderator: PayloadRequest | undefined

  const actors = async () => {
    writer ??= await createLocalReq({ user: asPayloadStaffUser(clinicStaff) }, payload)
    if (!moderator) {
      const platform = await createPlatformTestUser(payload, {
        emailPrefix: 'cross-app-review-decision-platform',
        createdStaffIds: [],
      })
      moderator = await createLocalReq({ user: asPayloadStaffUser(platform) }, payload)
    }
    return { writer, moderator }
  }
  const review = async () => {
    const treatment = (await payload.find({ collection: 'treatments', depth: 0, limit: 1, overrideAccess: true }))
      .docs[0]
    if (!treatment) throw new Error('Expected baseline treatment.')
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `cross-app-review-decision-patient-${++sequence}`,
      createdPatientIds: [],
    })
    return payload.create({
      collection: 'reviews',
      overrideAccess: true,
      depth: 0,
      data: {
        patient: patient.id,
        clinic: clinicId,
        doctor: doctorId,
        treatment: treatment.id,
        status: 'approved',
        starRating: 5,
        comment: `Synthetic decision review ${sequence}.`,
        authorVisibility: 'anonymous',
      } as Review,
    })
  }
  const evidence = async (reviewId: number) => {
    const result = await payload.find({
      collection: 'clinicNotificationOccurrences',
      overrideAccess: true,
      depth: 0,
      pagination: false,
      where: { and: [{ sourceRecordKind: { equals: 'review' } }, { sourceRecordId: { equals: String(reviewId) } }] },
    })
    return {
      reviewId: String(reviewId),
      notifications: result.docs.map(({ notificationId, eventType, occurredAt }) => ({
        notificationId,
        eventType,
        occurredAt,
      })),
    }
  }
  return {
    '/create-response-decision-review': async () => {
      const { writer, moderator } = await actors()
      const source = await review()
      const response = await payload.create({
        collection: 'reviewResponses',
        req: writer,
        overrideAccess: false,
        depth: 0,
        data: {
          review: source.id,
          pendingResponse: { body: 'Thank you for the detailed synthetic review.' },
        } as ReviewResponse,
      })
      await payload.update({
        collection: 'reviewResponses',
        id: response.id,
        req: moderator,
        overrideAccess: false,
        depth: 0,
        data: { moderationStatus: 'approved' },
      })
      return evidence(source.id)
    },
    '/create-appeal-decision-review': async () => {
      const { writer, moderator } = await actors()
      const source = await review()
      const appeal = await payload.create({
        collection: 'reviewAppeals',
        req: writer,
        overrideAccess: false,
        depth: 0,
        data: {
          review: source.id,
          reason: 'other',
          details: 'Synthetic appeal detail is private workflow content.',
        } as ReviewAppeal,
      })
      await payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        req: moderator,
        overrideAccess: false,
        depth: 0,
        data: { status: 'under_review' },
      })
      await payload.update({
        collection: 'reviewAppeals',
        id: appeal.id,
        req: moderator,
        overrideAccess: false,
        depth: 0,
        data: {
          status: 'dismissed',
          decisionReason: 'Private synthetic decision reason.',
        },
      })
      return evidence(source.id)
    },
  }
}
