import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { createClinicFixture } from '../../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../../fixtures/cleanupTestEntities'
import {
  asPayloadBasicUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../../fixtures/testUsers'
import { testSlug } from '../../fixtures/testSlug'
import type { BasicUser, Review } from '@/payload-types'

function extractRelationId(value: unknown): number | string | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) {
    return extractRelationId((value as { id?: unknown }).id)
  }
  return null
}

const buildReviewData = (input: {
  patientRelationId: number | string
  clinicId: number | string
  doctorId: number | string
  treatmentId: number
  comment: string
  status?: 'pending' | 'approved' | 'rejected'
  starRating?: number
  authorVisibility?: 'anonymous' | 'firstNameInitial'
  publicAuthorName?: string
}) =>
  ({
    patient: input.patientRelationId,
    clinic: input.clinicId,
    doctor: input.doctorId,
    treatment: input.treatmentId,
    comment: input.comment,
    status: input.status,
    starRating: input.starRating ?? 4,
    authorVisibility: input.authorVisibility,
    publicAuthorName: input.publicAuthorName,
  }) as unknown as Review

describe('Reviews access', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews-access.test.ts')
  const createdReviewIds: Array<number | string> = []
  const createdBasicUserIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []

  const createPlatformUser = async (suffix: string): Promise<BasicUser> => {
    return createPlatformTestUser(payload, {
      emailPrefix: suffix,
      firstName: 'Review',
      lastName: 'Moderator',
      createdBasicUserIds,
    })
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityResult = await payload.find({
      collection: 'cities',
      limit: 1,
      overrideAccess: true,
    })
    const cityDoc = cityResult.docs[0]
    if (!cityDoc) {
      throw new Error('Expected baseline city for review access tests')
    }
    cityId = cityDoc.id as number

    const treatmentResult = await payload.find({
      collection: 'treatments',
      limit: 1,
      overrideAccess: true,
    })
    const treatmentDoc = treatmentResult.docs[0]
    if (!treatmentDoc) {
      throw new Error('Expected baseline treatment for review access tests')
    }
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdReviewIds.length) {
      const id = createdReviewIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'reviews', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTrackedUsers(payload, {
      basicUserIds: createdBasicUserIds,
      patientIds: createdPatientIds,
    })

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('lets patients create reviews but reserves update, delete, and moderation fields for platform staff', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-patient-moderation`,
    })

    const patientUser = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Maya',
      lastName: 'Kaya',
      createdPatientIds,
    })
    const spoofedPatient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-spoofed-patient`,
      firstName: 'Spoofed',
      lastName: 'Author',
      createdPatientIds,
    })
    const moderator = await createPlatformUser(`${slugPrefix}-moderator`)

    const created = await payload.create({
      collection: 'reviews',
      data: buildReviewData({
        patientRelationId: spoofedPatient.id,
        clinicId: clinic.id,
        doctorId: doctor.id,
        treatmentId,
        comment: 'Patient-created review',
        status: 'approved',
        starRating: 5,
        authorVisibility: 'firstNameInitial',
        publicAuthorName: 'Spoofed Name',
      }),
      user: asPayloadPatientUser(patientUser),
      overrideAccess: false,
    })

    createdReviewIds.push(created.id)

    expect(created.status).toBe('pending')
    expect(created.publicAuthorName).toBe('Maya K.')

    const internalCreated = await payload.findByID({
      collection: 'reviews',
      id: created.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(extractRelationId(internalCreated.patient)).toBe(patientUser.id)

    await expect(
      payload.update({
        collection: 'reviews',
        id: created.id,
        data: { comment: 'Patient edit attempt' } as unknown as Review,
        user: asPayloadPatientUser(patientUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'reviews',
        id: created.id,
        user: asPayloadPatientUser(patientUser),
        overrideAccess: false,
      } as unknown as Parameters<Payload['delete']>[0]),
    ).rejects.toThrow()

    const moderated = await payload.update({
      collection: 'reviews',
      id: created.id,
      data: { status: 'approved', comment: 'Platform approved review' } as unknown as Review,
      user: asPayloadBasicUser(moderator),
      overrideAccess: false,
    })

    const editedBy =
      typeof moderated.editedBy === 'object' && moderated.editedBy ? moderated.editedBy.id : moderated.editedBy

    expect(moderated.status).toBe('approved')
    expect(editedBy).toBe(moderator.id)
    expect(moderated.editedByName).toBe('Review Moderator')
    expect(moderated.lastEditedAt).toBeTruthy()

    const deleted = await payload.delete({
      collection: 'reviews',
      id: created.id,
      user: asPayloadBasicUser(moderator),
      overrideAccess: false,
    })

    expect(deleted.id).toBe(created.id)
    createdReviewIds.pop()
  })

  it('shows only approved reviews to non-platform readers while platform sees the moderation queue', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-read-scope`,
    })

    const pendingAuthor = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-pending-author`,
      createdPatientIds,
    })
    const approvedAuthor = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-approved-author`,
      createdPatientIds,
    })

    const pendingReview = await payload.create({
      collection: 'reviews',
      data: buildReviewData({
        patientRelationId: pendingAuthor.id,
        clinicId: clinic.id,
        doctorId: doctor.id,
        treatmentId,
        comment: 'Pending review',
        status: 'pending',
      }),
      overrideAccess: true,
    })

    const approvedReview = await payload.create({
      collection: 'reviews',
      data: buildReviewData({
        patientRelationId: approvedAuthor.id,
        clinicId: clinic.id,
        doctorId: doctor.id,
        treatmentId,
        comment: 'Approved review',
        status: 'approved',
      }),
      overrideAccess: true,
    })

    createdReviewIds.push(pendingReview.id, approvedReview.id)

    const anonymousRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      overrideAccess: false,
    })

    expect(anonymousRead.docs).toHaveLength(1)
    expect(anonymousRead.docs[0]?.id).toBe(approvedReview.id)
    expect((anonymousRead.docs[0] as Record<string, unknown> | undefined)?.patient).toBeUndefined()

    const patientReader = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-reader`,
      createdPatientIds,
    })

    const patientRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      user: asPayloadPatientUser(patientReader),
      overrideAccess: false,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.id).toBe(approvedReview.id)
    expect((patientRead.docs[0] as Record<string, unknown> | undefined)?.patient).toBeUndefined()

    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-reader`,
      createdBasicUserIds,
    })

    const clinicRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      user: asPayloadBasicUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?.id).toBe(approvedReview.id)
    expect((clinicRead.docs[0] as Record<string, unknown> | undefined)?.patient).toBeUndefined()

    const moderator = await createPlatformUser(`${slugPrefix}-platform-reader`)
    const platformRead = await payload.find({
      collection: 'reviews',
      where: { clinic: { equals: clinic.id } },
      user: asPayloadBasicUser(moderator),
      overrideAccess: false,
    })

    expect(platformRead.docs.map((doc) => doc.id)).toEqual(
      expect.arrayContaining([pendingReview.id, approvedReview.id]),
    )
    expect(platformRead.docs).toHaveLength(2)
    expect(platformRead.docs.map((doc) => extractRelationId(doc.patient))).toEqual(
      expect.arrayContaining([pendingAuthor.id, approvedAuthor.id]),
    )
  })
})
