import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient, Review } from '@/payload-types'

const createdBasicUserIds: Array<string | number> = []
const createdPatientIds: Array<string | number> = []
const createdReviewIds: Array<string | number> = []

async function createPlatformStaff(payload: Payload, suffix: string) {
  const basicUser = await payload.create({
    collection: 'basicUsers',
    data: {
      email: `${suffix}@example.com`,
      userType: 'platform',
      firstName: 'Review',
      lastName: 'Owner',
      supabaseUserId: `sb-${suffix}`,
    } as unknown as BasicUser,
    overrideAccess: true,
    depth: 0,
  })

  createdBasicUserIds.push(basicUser.id)

  const staffRes = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  const staffDoc = staffRes.docs[0]
  if (!staffDoc) {
    throw new Error('Expected platform staff profile for review tests')
  }

  return { basicUser, platformStaffId: staffDoc.id }
}

async function createPatient(payload: Payload, suffix: string) {
  const patient = await payload.create({
    collection: 'patients',
    data: {
      email: `${suffix}@example.com`,
      firstName: 'Patient',
      lastName: 'Reviewer',
      supabaseUserId: `sb-patient-${suffix}`,
    } as unknown as Patient,
    overrideAccess: true,
    depth: 0,
  })

  createdPatientIds.push(patient.id)

  return patient
}

describe('Reviews integration - lifecycle and access', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for review lifecycle tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for review lifecycle tests')
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

  it('creates a review with defaults via platform access', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-defaults`,
    })

    const { basicUser, platformStaffId } = await createPlatformStaff(payload, `${slugPrefix}-platform-defaults`)

    const created = await payload.create({
      collection: 'reviews',
      data: {
        patient: platformStaffId,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: 'Defaulted review fields',
      } as unknown as Review,
      user: { ...basicUser, collection: 'basicUsers' },
      overrideAccess: false,
    })

    createdReviewIds.push(created.id)

    expect(created.status).toBe('pending')
    expect(created.reviewDate).toBeTruthy()
  }, 60000)

  it('allows patient create but blocks update and delete', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-patient-access`,
    })

    const patient = await createPatient(payload, `${slugPrefix}-patient-access`)
    const { platformStaffId } = await createPlatformStaff(payload, `${slugPrefix}-patient-reviewer`)

    const created = await payload.create({
      collection: 'reviews',
      data: {
        patient: platformStaffId,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Patient-created review',
      } as unknown as Review,
      user: { ...patient, collection: 'patients' },
      overrideAccess: false,
    })

    createdReviewIds.push(created.id)

    await expect(
      payload.update({
        collection: 'reviews',
        id: created.id,
        data: { comment: 'Attempted edit' } as unknown as Review,
        user: { ...patient, collection: 'patients' },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'reviews',
        id: created.id,
        user: { ...patient, collection: 'patients' },
        overrideAccess: false,
      } as unknown as Parameters<Payload['delete']>[0]),
    ).rejects.toThrow()
  }, 60000)

  it.each([
    ['clinic', { clinic: undefined }],
    ['doctor', { doctor: undefined }],
    ['treatment', { treatment: undefined }],
  ])('rejects missing %s relationship', async (_label, overrides) => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-missing-${_label}`,
    })

    const { platformStaffId } = await createPlatformStaff(payload, `${slugPrefix}-missing-${_label}`)

    const data = {
      patient: platformStaffId,
      clinic: clinic.id,
      doctor: doctor.id,
      treatment: treatmentId,
      starRating: 3,
      comment: 'Validation check',
      ...overrides,
    }

    await expect(
      payload.create({
        collection: 'reviews',
        data: data as unknown as Review,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/clinic, doctor, and treatment/i)
  })

  it('rejects star ratings outside 1-5 range', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-rating-range`,
    })

    const { platformStaffId } = await createPlatformStaff(payload, `${slugPrefix}-rating-range`)

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: platformStaffId,
          clinic: clinic.id,
          doctor: doctor.id,
          treatment: treatmentId,
          starRating: 6,
          comment: 'Too high',
        } as unknown as Review,
        overrideAccess: true,
      }),
    ).rejects.toThrow(/star|rating|min|max|range|between/i)
  }, 60000)

  it('scopes public reads to approved reviews only', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-read-scope`,
    })

    const { basicUser, platformStaffId: platformStaffA } = await createPlatformStaff(payload, `${slugPrefix}-read-a`)
    const { platformStaffId: platformStaffB } = await createPlatformStaff(payload, `${slugPrefix}-read-b`)

    const pendingReview = await payload.create({
      collection: 'reviews',
      data: {
        patient: platformStaffA,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 2,
        comment: 'Pending review',
        status: 'pending',
      } as unknown as Review,
      overrideAccess: true,
    })

    const approvedReview = await payload.create({
      collection: 'reviews',
      data: {
        patient: platformStaffB,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Approved review',
        status: 'approved',
      } as unknown as Review,
      overrideAccess: true,
    })

    createdReviewIds.push(pendingReview.id, approvedReview.id)

    const publicRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      overrideAccess: false,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.status).toBe('approved')

    const platformRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      user: { ...basicUser, collection: 'basicUsers' },
      overrideAccess: false,
    })

    expect(platformRead.docs).toHaveLength(2)
  }, 60000)
})
