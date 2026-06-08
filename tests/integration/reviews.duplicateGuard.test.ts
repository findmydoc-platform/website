import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { asPayloadPatientUser, createPatientTestUser } from '../fixtures/testUsers'
import type { Review } from '@/payload-types'

const createdPatientIds: Array<string | number> = []
const createdReviewIds: Array<string | number> = []
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

async function createReviewPatient(payload: Payload, identifier: string): Promise<number> {
  const patient = await createPatientTestUser(payload, {
    emailPrefix: identifier,
    firstName: 'Review',
    lastName: 'Patient',
    supabaseUserId: identifier,
    createdPatientIds,
  })

  return patient.id
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

    while (createdPatientIds.length) {
      const patientId = createdPatientIds.pop()
      if (!patientId) continue
      try {
        await payload.delete({ collection: 'patients', id: patientId, overrideAccess: true })
      } catch {}
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('blocks duplicate reviews while allowing legitimate updates', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-duplicate`,
    })

    const patient = await createReviewPatient(payload, `${slugPrefix}-patient`)

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

  it('blocks duplicate patient-created pending reviews that are hidden by read access', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-patient-duplicate`,
    })

    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-duplicate`,
      firstName: 'Duplicate',
      lastName: 'Patient',
      supabaseUserId: `${slugPrefix}-patient-duplicate`,
      createdPatientIds,
    })

    const patientReviewData: Pick<Review, 'patient' | 'clinic' | 'doctor' | 'treatment' | 'starRating' | 'comment'> = {
      patient: patient.id,
      clinic: clinic.id,
      doctor: doctor.id,
      treatment: treatmentId,
      starRating: 4,
      comment: 'First patient-created pending review',
    }

    const firstReview = (await payload.create({
      collection: 'reviews',
      data: patientReviewData,
      user: asPayloadPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as Review

    createdReviewIds.push(firstReview.id)

    expect(firstReview.status).toBe('pending')

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          ...patientReviewData,
          comment: 'Second patient-created pending review',
        },
        user: asPayloadPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/Duplicate review/i)
  }, 60000)
})
