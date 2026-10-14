import { createLocalReq, type Payload } from 'payload'
import { createPatientTestUser } from '../tests/fixtures/testUsers'
import type { Review } from '../src/payload-types'

/** Synthetic commands run only inside the isolated local acceptance harness. */
export function createReviewNotificationControl(input: { payload: Payload; clinicId: number; doctorId: number }) {
  const { payload, clinicId, doctorId } = input
  let lastReviewId: number | undefined
  let reviewSequence = 0
  const source = async () => {
    if (lastReviewId === undefined) throw new Error('Expected a synthetic captured review.')
    return lastReviewId
  }
  const events = async () => {
    const id = await source()
    const result = await payload.find({
      collection: 'clinicNotificationOccurrences',
      overrideAccess: true,
      depth: 0,
      limit: 25,
      where: { and: [{ sourceRecordKind: { equals: 'review' } }, { sourceRecordId: { equals: String(id) } }] },
    })
    return {
      reviewId: String(id),
      notifications: result.docs.map(({ notificationId, eventType, occurredAt }) => ({
        notificationId,
        eventType,
        occurredAt,
      })),
    }
  }
  return {
    '/create-notification-review': async () => {
      const treatments = await payload.find({ collection: 'treatments', depth: 0, limit: 1, overrideAccess: true })
      const treatment = treatments.docs[0]
      if (!treatment) throw new Error('Expected baseline treatment.')
      const patient = await createPatientTestUser(payload, {
        emailPrefix: `cross-app-review-patient-${++reviewSequence}`,
        createdPatientIds: [],
      })
      const review = await payload.create({
        collection: 'reviews',
        overrideAccess: true,
        depth: 0,
        data: {
          patient: patient.id,
          clinic: clinicId,
          doctor: doctorId,
          treatment: treatment.id,
          status: 'pending',
          starRating: 5,
          comment: 'Exact synthetic review from a notification.',
          authorVisibility: 'anonymous',
        } as Review,
      })
      lastReviewId = review.id
      await payload.update({
        collection: 'reviews',
        id: review.id,
        overrideAccess: true,
        data: { status: 'approved' },
        depth: 0,
      })
      return events()
    },
    '/withdraw-notification-review': async () => {
      const req = await createLocalReq({}, payload)
      // Native override writes exercise the same trusted source hook as the authorized command.
      await payload.update({
        collection: 'reviews',
        id: await source(),
        overrideAccess: true,
        req,
        data: {
          withdrawalState: 'withdrawn',
          withdrawalSource: 'platform',
          withdrawnAt: new Date().toISOString(),
          withdrawalReason: 'Synthetic authorized withdrawal.',
        },
      })
      return events()
    },
    '/remove-notification-review': async () => {
      await payload.update({
        collection: 'reviews',
        id: await source(),
        overrideAccess: true,
        data: {
          publicMeasure: 'removed',
          moderatedAt: new Date().toISOString(),
          moderationReason: 'Synthetic authorized removal.',
        },
      })
      return events()
    },
    '/trash-notification-review': async () => {
      await payload.update({
        collection: 'reviews',
        id: await source(),
        overrideAccess: true,
        data: { deletedAt: new Date().toISOString() },
      })
      return events()
    },
  }
}
