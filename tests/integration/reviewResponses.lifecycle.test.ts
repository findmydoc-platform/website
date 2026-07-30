import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import type { Review, ReviewResponse } from '@/payload-types'
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

const relationId = (value: unknown): string | number | null => {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return relationId((value as { id?: unknown }).id)
  }
  return null
}

describe('reviewResponses lifecycle', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviewResponses.lifecycle.test.ts')
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
        starRating: 5,
        comment: `Approved review for ${suffix}`,
        status: 'approved',
      } as unknown as Review,
      overrideAccess: true,
      depth: 0,
    })
    reviewIds.push(review.id)

    return { clinic, review }
  }

  it('keeps the approved response public while a clinic revision is pending or rejected', async () => {
    const { clinic, review } = await createApprovedReview('moderation')
    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-moderation-clinic`,
      createdStaffIds: staffIds,
    })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-moderation-platform`,
      createdStaffIds: staffIds,
    })

    const pending = await payload.create({
      collection: 'reviewResponses',
      data: {
        review: review.id,
        pendingResponse: {
          body: 'Thank you for the feedback. We have shared it with our clinical team.',
        },
      } as unknown as ReviewResponse,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    responseIds.push(pending.id)

    expect(relationId(pending.clinic)).toBe(clinic.id)
    expect(pending.moderationStatus).toBe('pending')
    expect(pending.pendingResponse?.body).toBe('Thank you for the feedback. We have shared it with our clinical team.')

    const beforeApproval = await payload.find({
      collection: 'reviewResponses',
      overrideAccess: false,
      depth: 0,
    })
    expect(beforeApproval.docs).toHaveLength(0)

    const approved = await payload.update({
      collection: 'reviewResponses',
      id: pending.id,
      data: {
        moderationStatus: 'approved',
      } as unknown as ReviewResponse,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })

    expect(approved.publishedResponse?.body).toBe(
      'Thank you for the feedback. We have shared it with our clinical team.',
    )
    expect(approved.pendingResponse).toBeFalsy()

    const publicApproved = await payload.find({
      collection: 'reviewResponses',
      overrideAccess: false,
      depth: 0,
    })
    expect(publicApproved.docs).toHaveLength(1)
    expect(publicApproved.docs[0]?.publishedResponse?.body).toBe(approved.publishedResponse?.body)
    expect((publicApproved.docs[0] as unknown as Record<string, unknown>).moderationReason).toBeUndefined()
    expect((publicApproved.docs[0] as unknown as Record<string, unknown>).lastActionBy).toBeUndefined()

    const revision = await payload.update({
      collection: 'reviewResponses',
      id: approved.id,
      data: {
        pendingResponse: {
          body: 'Thank you again. This revised response includes additional follow-up information.',
        },
      } as unknown as ReviewResponse,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })

    expect(revision.moderationStatus).toBe('pending')
    expect(revision.publishedResponse?.body).toBe(approved.publishedResponse?.body)

    const publicDuringRevision = await payload.findByID({
      collection: 'reviewResponses',
      id: approved.id,
      overrideAccess: false,
      depth: 0,
    })
    expect(publicDuringRevision.publishedResponse?.body).toBe(approved.publishedResponse?.body)

    const rejected = await payload.update({
      collection: 'reviewResponses',
      id: approved.id,
      data: {
        moderationStatus: 'rejected',
        moderationReason: 'The revision contains internal operational details that are not suitable for publication.',
      } as unknown as ReviewResponse,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })

    expect(rejected.moderationStatus).toBe('rejected')
    expect(rejected.pendingResponse).toBeFalsy()
    expect(rejected.publishedResponse?.body).toBe(approved.publishedResponse?.body)

    const ownVersions = await payload.findVersions({
      collection: 'reviewResponses',
      where: { parent: { equals: approved.id } },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(ownVersions.docs.length).toBeGreaterThanOrEqual(3)

    await expect(
      payload.delete({
        collection: 'reviewResponses',
        id: approved.id,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.restoreVersion({
        collection: 'reviewResponses',
        id: ownVersions.docs[0]!.id,
        user: asPayloadStaffUser(moderator),
        overrideAccess: false,
      }),
    ).rejects.toThrow('immutable audit records')
  }, 60000)

  it('fails closed when a parent review is no longer approved even if its response was not blocked', async () => {
    const { review } = await createApprovedReview('parent-rejected')
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-parent-rejected-platform`,
      createdStaffIds: staffIds,
    })
    const response = await payload.create({
      collection: 'reviewResponses',
      data: {
        review: review.id,
        pendingResponse: {
          body: 'Thank you for the detailed feedback. The clinic has reviewed it with the responsible team.',
        },
        moderationStatus: 'approved',
      } as unknown as ReviewResponse,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })
    responseIds.push(response.id)

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        status: 'rejected',
      } as unknown as Review,
      user: asPayloadStaffUser(moderator),
      overrideAccess: false,
      depth: 0,
    })

    const internalResponse = await payload.findByID({
      collection: 'reviewResponses',
      id: response.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(internalResponse.publishedResponse?.isBlocked).toBe(false)

    const publicResponses = await payload.find({
      collection: 'reviewResponses',
      where: { id: { equals: response.id } },
      overrideAccess: false,
      depth: 0,
    })
    expect(publicResponses.docs).toHaveLength(0)
  }, 60000)

  it('scopes private workflow reads and anonymizes actor relations without losing audit history', async () => {
    const { clinic, review } = await createApprovedReview('audit')
    const foreign = await createApprovedReview('foreign')
    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-audit-clinic`,
      createdStaffIds: staffIds,
    })
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)
    const foreignStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-audit-foreign`,
      createdStaffIds: staffIds,
    })
    const foreignUser = await asClinicScopedPayloadUser(payload, foreignStaff, foreign.clinic.id)

    await expect(
      payload.create({
        collection: 'reviewResponses',
        data: {
          review: foreign.review.id,
          pendingResponse: {
            body: 'This clinic must not be able to respond to a review assigned to another clinic.',
          },
        } as unknown as ReviewResponse,
        user: clinicUser,
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          expect.objectContaining({
            message: expect.stringContaining('does not belong to the assigned clinic'),
            path: 'review',
          }),
        ],
      },
    })

    const response = await payload.create({
      collection: 'reviewResponses',
      data: {
        review: review.id,
        pendingResponse: {
          body: 'We appreciate the review and have documented the feedback for our care team.',
        },
      } as unknown as ReviewResponse,
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    responseIds.push(response.id)

    const ownRead = await payload.find({
      collection: 'reviewResponses',
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    const foreignRead = await payload.find({
      collection: 'reviewResponses',
      user: foreignUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(ownRead.docs.map((doc) => doc.id)).toContain(response.id)
    expect(foreignRead.docs.map((doc) => doc.id)).not.toContain(response.id)

    const foreignVersions = await payload.findVersions({
      collection: 'reviewResponses',
      user: foreignUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(foreignVersions.docs).toHaveLength(0)

    await payload.delete({
      collection: 'clinicStaff',
      id: clinicStaff.id,
      overrideAccess: true,
    })

    const anonymized = await payload.findByID({
      collection: 'reviewResponses',
      id: response.id,
      overrideAccess: true,
      depth: 0,
    })
    expect(anonymized.lastActionBy).toBeFalsy()
    expect(anonymized.lastActorType).toBe('clinic_staff')
    expect(anonymized.lastAction).toBe('submitted')
    expect(anonymized.lastActionAt).toBeTruthy()

    const versions = await payload.findVersions({
      collection: 'reviewResponses',
      where: { parent: { equals: response.id } },
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    expect(versions.docs.length).toBeGreaterThan(0)
    expect(versions.docs.every((version) => !version.version.lastActionBy)).toBe(true)
    expect(versions.docs.every((version) => version.version.lastActorType === 'clinic_staff')).toBe(true)
  }, 60000)
})
