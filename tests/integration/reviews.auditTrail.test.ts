/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'

const createdBasicUserIds: Array<string | number> = []

async function createPlatformUser(payload: Payload, emailPrefix: string) {
  const email = `${emailPrefix}@example.com`
  const basicUser = await (payload as any).create({
    collection: 'basicUsers',
    data: {
      email,
      userType: 'platform',
      firstName: 'Audit',
      lastName: 'Tester',
      supabaseUserId: `sb-${emailPrefix}`,
    },
    overrideAccess: true,
  })

  createdBasicUserIds.push(basicUser.id)

  const platformStaff = await (payload as any).find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  // We need the platformStaff ID for the 'patient' relation on review
  // But we need the basicUser object for the 'req.user' / 'editedBy' relation
  return { basicUser, platformStaffId: platformStaff.docs[0].id }
}

describe('Review audit trail hooks', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
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
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('populates editedBy and editedByName on update', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-audit`,
    })

    const { basicUser, platformStaffId } = await createPlatformUser(payload, 'audit.tester')

    // 1. Create Review (should allow creation without setting editedBy)
    const review = await (payload as any).create({
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
    })

    // Assert initial state
    expect(review.editedBy).toBeFalsy()
    expect(review.editedByName).toBeFalsy()
    expect(review.lastEditedAt).toBeFalsy()

    // 2. Update Review as Platform User
    const updatedReview = await (payload as any).update({
      collection: 'reviews',
      id: review.id,
      data: {
        status: 'approved',
        comment: 'Moderated comment',
      },
      user: { ...basicUser, collection: 'basicUsers' }, // This sets req.user
      overrideAccess: false, // Ensure we use the access control/hooks that utilize req.user
    })

    // Assert audit trail
    // editedBy might be populated, so we check ID if it is an object
    const editedBy = updatedReview.editedBy as any
    expect(editedBy?.id || editedBy).toBe(basicUser.id)

    expect(updatedReview.editedByName).toBe('Audit Tester')
    expect(updatedReview.lastEditedAt).toBeDefined()

    // Verify string is constructed from firstName + lastName
    expect(basicUser.firstName).toBe('Audit')
    expect(basicUser.lastName).toBe('Tester')
  }, 60000)
})
