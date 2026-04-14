import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { asPayloadBasicUser, createPlatformTestUser } from '../fixtures/testUsers'
import type { Review } from '@/payload-types'

const createdBasicUserIds: Array<string | number> = []
type PayloadCreateArgs = Parameters<Payload['create']>[0]

async function createPlatformUser(payload: Payload, emailPrefix: string) {
  const basicUser = await createPlatformTestUser(payload, {
    emailPrefix,
    firstName: 'Audit',
    lastName: 'Tester',
    supabaseUserId: `sb-${emailPrefix}`,
    createdBasicUserIds,
  })

  const platformStaff = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const staffDoc = platformStaff.docs[0]
  if (!staffDoc) {
    throw new Error('Expected platform staff profile to be created for audit test user')
  }

  // We need the platformStaff ID for the 'patient' relation on review
  // But we need the basicUser object for the 'req.user' / 'editedBy' relation
  return { basicUser, platformStaffId: staffDoc.id }
}

describe('Review audit trail hooks', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  let reviewId: number | null = null
  const slugPrefix = testSlug('reviews.auditTrail.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for review audit tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for review audit tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    if (reviewId) {
      try {
        await payload.delete({ collection: 'reviews', id: reviewId, overrideAccess: true })
      } catch {}
      reviewId = null
    }

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('populates editedBy and editedByName on update', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-audit`,
    })

    const { basicUser, platformStaffId } = await createPlatformUser(payload, 'audit.tester')

    // 1. Create Review (should allow creation without setting editedBy)
    const review = (await payload.create({
      collection: 'reviews',
      data: {
        patient: platformStaffId,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Original comment',
        status: 'pending',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Review

    reviewId = review.id as number

    // Assert initial state
    expect(review.editedBy).toBeFalsy()
    expect(review.editedByName).toBeFalsy()
    expect(review.lastEditedAt).toBeFalsy()

    // 2. Update Review as Platform User
    const updatedReview = await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        status: 'approved',
        comment: 'Moderated comment',
      },
      user: asPayloadBasicUser(basicUser), // This sets req.user
      overrideAccess: false, // Ensure we use the access control/hooks that utilize req.user
      depth: 0,
    })

    // Assert audit trail
    // editedBy might be populated, so we check ID if it is an object
    const editedBy =
      typeof updatedReview.editedBy === 'object' && updatedReview.editedBy !== null
        ? updatedReview.editedBy.id
        : updatedReview.editedBy
    expect(editedBy).toBe(basicUser.id)

    expect(updatedReview.editedByName).toBe('Audit Tester')
    expect(updatedReview.lastEditedAt).toBeDefined()

    // Verify string is constructed from firstName + lastName
    expect(basicUser.firstName).toBe('Audit')
    expect(basicUser.lastName).toBe('Tester')
  }, 60000)
})
