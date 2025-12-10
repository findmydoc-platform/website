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

async function createPlatformUser(payload: Payload) {
  const email = 'ratings.tester@example.com'
  const basicUser = await (payload as any).create({
    collection: 'basicUsers',
    data: {
      email,
      userType: 'platform',
      firstName: 'Ratings',
      lastName: 'Tester',
      // Provide deterministic Supabase ID to bypass mocked provisioner duplicate constraint
      supabaseUserId: 'sb-ratings-single',
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

  const staffDoc = platformStaff.docs[0]
  if (!staffDoc) {
    throw new Error('Expected platform staff profile to be created for ratings test user')
  }

  return staffDoc.id
}

describe('Review average ratings hooks', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.averageRatings.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for review rating tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for review rating tests')
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

  it('recomputes average ratings on review create, update, and delete', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-ratings`,
    })

    const patient = await createPlatformUser(payload)

    const review = await (payload as any).create({
      collection: 'reviews',
      data: {
        patient,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: 'Solid experience.',
        status: 'approved',
      },
      overrideAccess: true,
    })

    const clinicAfterCreate = await payload.findByID({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    const doctorAfterCreate = await payload.findByID({ collection: 'doctors', id: doctor.id, overrideAccess: true })
    const treatmentAfterCreate = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    expect(clinicAfterCreate.averageRating).toBeCloseTo(4, 5)
    expect(doctorAfterCreate.averageRating).toBeCloseTo(4, 5)
    expect(treatmentAfterCreate.averageRating).toBeCloseTo(4, 5)

    const reviewAfterUpdate = await (payload as any).update({
      collection: 'reviews',
      id: review.id,
      data: {
        starRating: 2,
        comment: 'Could improve follow-up.',
        status: 'approved',
      },
      overrideAccess: true,
    })

    expect(reviewAfterUpdate.starRating).toBe(2)

    const clinicAfterUpdate = await payload.findByID({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    const doctorAfterUpdate = await payload.findByID({ collection: 'doctors', id: doctor.id, overrideAccess: true })
    const treatmentAfterUpdate = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    expect(clinicAfterUpdate.averageRating).toBeCloseTo(2, 5)
    expect(doctorAfterUpdate.averageRating).toBeCloseTo(2, 5)
    expect(treatmentAfterUpdate.averageRating).toBeCloseTo(2, 5)

    await payload.delete({ collection: 'reviews', id: review.id, overrideAccess: true })

    const clinicAfterDelete = await payload.findByID({ collection: 'clinics', id: clinic.id, overrideAccess: true })
    const doctorAfterDelete = await payload.findByID({ collection: 'doctors', id: doctor.id, overrideAccess: true })
    const treatmentAfterDelete = await payload.findByID({
      collection: 'treatments',
      id: treatmentId,
      overrideAccess: true,
    })

    expect(clinicAfterDelete.averageRating ?? null).toBeNull()
    expect(doctorAfterDelete.averageRating ?? null).toBeNull()
    expect(treatmentAfterDelete.averageRating ?? null).toBeNull()
  }, 60000)
})
