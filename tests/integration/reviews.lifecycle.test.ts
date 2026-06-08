import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  asPayloadBasicUser,
  asPayloadPatientUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import type { Review } from '@/payload-types'

const createdBasicUserIds: Array<string | number> = []
const createdPatientIds: Array<string | number> = []
const createdReviewIds: Array<string | number> = []

function extractRelationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }
  return null
}

async function createPlatformModerator(payload: Payload, suffix: string) {
  return createPlatformTestUser(payload, {
    emailPrefix: suffix,
    firstName: 'Review',
    lastName: 'Owner',
    createdBasicUserIds,
  })
}

async function createPatient(payload: Payload, suffix: string) {
  return createPatientTestUser(payload, {
    emailPrefix: suffix,
    lastName: 'Reviewer',
    supabaseUserId: `sb-patient-${suffix}`,
    createdPatientIds,
  })
}

async function createClinicUser(payload: Payload, suffix: string) {
  return createClinicTestUser(payload, {
    emailPrefix: suffix,
    lastName: 'Reviewer',
    supabaseUserId: `sb-clinic-${suffix}`,
    createdBasicUserIds,
  })
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

    const basicUser = await createPlatformModerator(payload, `${slugPrefix}-platform-defaults`)
    const patient = await createPatient(payload, `${slugPrefix}-platform-defaults-patient`)

    const created = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: 'Defaulted review fields',
      } as unknown as Review,
      user: asPayloadBasicUser(basicUser),
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
    const spoofedPatient = await createPatient(payload, `${slugPrefix}-patient-spoof`)
    const spoofedEditor = await createPlatformModerator(payload, `${slugPrefix}-patient-spoof-editor`)

    const created = await payload.create({
      collection: 'reviews',
      data: {
        patient: spoofedPatient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Patient-created review',
        status: 'approved',
        authorVisibility: 'firstNameInitial',
        publicAuthorName: 'Spoofed Name',
        lastEditedAt: '2026-01-01T00:00:00.000Z',
        editedByName: 'Spoofed Editor',
        editedBy: spoofedEditor.id,
      } as unknown as Review,
      user: asPayloadPatientUser(patient),
      overrideAccess: false,
    })

    createdReviewIds.push(created.id)

    expect(created.status).toBe('pending')
    expect(created.publicAuthorName).toBe('Patient R.')
    expect(created.lastEditedAt).toBeFalsy()
    expect(created.editedByName).toBeFalsy()
    expect(extractRelationId(created.editedBy)).toBeNull()

    const internalCreated = await payload.findByID({
      collection: 'reviews',
      id: created.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(extractRelationId(internalCreated.patient)).toBe(patient.id)
    expect(internalCreated.lastEditedAt).toBeFalsy()
    expect(internalCreated.editedByName).toBeFalsy()
    expect(extractRelationId(internalCreated.editedBy)).toBeNull()

    await expect(
      payload.update({
        collection: 'reviews',
        id: created.id,
        data: { comment: 'Attempted edit' } as unknown as Review,
        user: asPayloadPatientUser(patient),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'reviews',
        id: created.id,
        user: asPayloadPatientUser(patient),
        overrideAccess: false,
      } as unknown as Parameters<Payload['delete']>[0]),
    ).rejects.toThrow()
  }, 60000)

  it('anonymizes public review author snapshots before deleting a patient', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-patient-delete-anonymize`,
    })

    const moderator = await createPlatformModerator(payload, `${slugPrefix}-patient-delete-anonymize-moderator`)
    const patient = await createPatient(payload, `${slugPrefix}-patient-delete-anonymize`)

    const review = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'Opted-in public review before account deletion',
        status: 'approved',
        authorVisibility: 'firstNameInitial',
      } as unknown as Review,
      user: asPayloadBasicUser(moderator),
      overrideAccess: false,
      depth: 0,
    })

    createdReviewIds.push(review.id)

    expect(review.publicAuthorName).toBe('Patient R.')

    await payload.delete({
      collection: 'patients',
      id: patient.id,
      user: asPayloadBasicUser(moderator),
      overrideAccess: false,
    })

    const patientIndex = createdPatientIds.indexOf(patient.id)
    if (patientIndex >= 0) createdPatientIds.splice(patientIndex, 1)

    const scrubbedReview = await payload.findByID({
      collection: 'reviews',
      id: review.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(scrubbedReview.authorVisibility).toBe('anonymous')
    expect(scrubbedReview.publicAuthorName).toBeNull()
  }, 60000)

  it('blocks clinic and anonymous users from creating reviews', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-clinic-anon-create`,
    })

    const clinicUser = await createClinicUser(payload, `${slugPrefix}-clinic-author`)
    const patient = await createPatient(payload, `${slugPrefix}-clinic-anon-reviewer`)

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: patient.id,
          clinic: clinic.id,
          doctor: doctor.id,
          treatment: treatmentId,
          starRating: 4,
          comment: 'Clinic user should not create reviews',
        } as unknown as Review,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: patient.id,
          clinic: clinic.id,
          doctor: doctor.id,
          treatment: treatmentId,
          starRating: 4,
          comment: 'Anonymous should not create reviews',
        } as unknown as Review,
        overrideAccess: false,
      }),
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

    const patient = await createPatient(payload, `${slugPrefix}-missing-${_label}`)

    const data = {
      patient: patient.id,
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

    const patient = await createPatient(payload, `${slugPrefix}-rating-range`)

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: patient.id,
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

    const basicUser = await createPlatformModerator(payload, `${slugPrefix}-read-platform`)
    const patientA = await createPatient(payload, `${slugPrefix}-read-a`)
    const patientB = await createPatient(payload, `${slugPrefix}-read-b`)

    const pendingReview = await payload.create({
      collection: 'reviews',
      data: {
        patient: patientA.id,
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
        patient: patientB.id,
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
      user: asPayloadBasicUser(basicUser),
      overrideAccess: false,
    })

    expect(platformRead.docs).toHaveLength(2)
  }, 60000)
})
