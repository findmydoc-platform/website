import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { createPlatformTestUser } from '../fixtures/testUsers'
import type { Review } from '@/payload-types'

const createdBasicUserIds: Array<string | number> = []
const createdReviewIds: Array<string | number> = []
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

async function createPlatformPatient(payload: Payload, identifier: string): Promise<number> {
  const basicUser = await createPlatformTestUser(payload, {
    emailPrefix: identifier,
    firstName: 'Review',
    lastName: 'Patient',
    supabaseUserId: identifier,
    createdBasicUserIds,
  })

  const staffRes = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
    depth: 0,
  })

  const staffDoc = staffRes.docs?.[0]
  if (!staffDoc) {
    throw new Error('Expected platform staff profile for patient user')
  }

  return staffDoc.id
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
        await payload.delete({ collection: 'reviews', id: reviewId, overrideAccess: true, trash: true })
      } catch {}
    }

    while (createdBasicUserIds.length) {
      const basicUserId = createdBasicUserIds.pop()
      if (!basicUserId) continue
      try {
        await payload.delete({ collection: 'basicUsers', id: basicUserId, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('blocks duplicate reviews while allowing legitimate updates', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-duplicate`,
    })

    const patient = await createPlatformPatient(payload, `${slugPrefix}-patient`)

    const baseReviewData: Pick<
      Review,
      'patient' | 'clinic' | 'doctor' | 'treatment' | 'starRating' | 'comment' | 'status'
    > = {
      patient,
      clinic: clinic.id,
      doctor: doctor.id,
      treatment: treatmentId,
      starRating: 5,
      comment: 'Fantastic visit',
      status: 'approved',
    }

    const review = (await payload.create({
      collection: 'reviews',
      data: baseReviewData,
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Review

    createdReviewIds.push(review.id)

    expect(review.reviewDate).toBeTruthy()

    await expect(
      payload.create({
        collection: 'reviews',
        data: { ...baseReviewData, comment: 'Trying to double dip' },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/Duplicate review/i)

    const updated = (await payload.update({
      collection: 'reviews',
      id: review.id,
      data: {
        ...baseReviewData,
        starRating: 3,
        comment: 'Adjusted after follow-up',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as Review

    expect(updated.starRating).toBe(3)
    expect(updated.comment).toContain('Adjusted')
  }, 60000)

  it('blocks duplicate reviews when the original matching review is trashed', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-trashed-duplicate`,
    })

    const patient = await createPlatformPatient(payload, `${slugPrefix}-trashed-patient`)

    const baseReviewData: Pick<
      Review,
      'patient' | 'clinic' | 'doctor' | 'treatment' | 'starRating' | 'comment' | 'status'
    > = {
      patient,
      clinic: clinic.id,
      doctor: doctor.id,
      treatment: treatmentId,
      starRating: 4,
      comment: 'Review to trash before duplicate attempt',
      status: 'approved',
    }

    const review = (await payload.create({
      collection: 'reviews',
      data: baseReviewData,
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Review

    createdReviewIds.push(review.id)

    await payload.update({
      collection: 'reviews',
      id: review.id,
      data: { deletedAt: new Date().toISOString() },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    await expect(
      payload.create({
        collection: 'reviews',
        data: { ...baseReviewData, comment: 'Trying to recreate trashed review' },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/Duplicate review/i)
  }, 60000)
})
