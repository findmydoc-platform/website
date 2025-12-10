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
const createdReviewIds: Array<string | number> = []

async function createPlatformPatient(payload: Payload, identifier: string) {
  const basicUser = await (payload as any).create({
    collection: 'basicUsers',
    data: {
      email: `${identifier}@example.com`,
      userType: 'platform',
      firstName: 'Review',
      lastName: 'Patient',
      supabaseUserId: identifier,
    },
    overrideAccess: true,
  })

  createdBasicUserIds.push(basicUser.id)

  const staffRes = await (payload as any).find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  const staffDoc = staffRes.docs?.[0]
  if (!staffDoc) {
    throw new Error('Expected platform staff profile for patient user')
  }

  return staffDoc.id as string | number
}

describe('Review duplicate prevention', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.duplicateGuard.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for review duplicate tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for review duplicate tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdReviewIds.length) {
      const reviewId = createdReviewIds.pop()
      if (!reviewId) continue
      try {
        await payload.delete({ collection: 'reviews', id: reviewId, overrideAccess: true })
      } catch {}
    }

    while (createdBasicUserIds.length) {
      const basicUserId = createdBasicUserIds.pop()
      if (!basicUserId) continue
      try {
        await payload.delete({ collection: 'basicUsers', id: basicUserId, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)
  })

  it('blocks duplicate reviews while allowing legitimate updates', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-duplicate`,
    })

    const patient = await createPlatformPatient(payload, `${slugPrefix}-patient`)

    const baseReviewData = {
      patient,
      clinic: clinic.id,
      doctor: doctor.id,
      treatment: treatmentId,
      starRating: 5,
      comment: 'Fantastic visit',
      status: 'approved',
    }

    const review = await (payload as any).create({
      collection: 'reviews',
      data: baseReviewData,
      overrideAccess: true,
    })

    createdReviewIds.push(review.id)

    expect(review.reviewDate).toBeTruthy()

    await expect(
      (payload as any).create({
        collection: 'reviews',
        data: { ...baseReviewData, comment: 'Trying to double dip' },
        overrideAccess: true,
      }),
    ).rejects.toThrow(/Duplicate review/i)

    const updated = await (payload as any).update({
      collection: 'reviews',
      id: review.id,
      data: {
        ...baseReviewData,
        starRating: 3,
        comment: 'Adjusted after follow-up',
      },
      overrideAccess: true,
    })

    expect(updated.starRating).toBe(3)
    expect(updated.comment).toContain('Adjusted')
  }, 60000)
})
