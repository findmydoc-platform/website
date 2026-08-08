import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

import type { Review } from '@/payload-types'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  asPayloadStaffUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'

const platformOnlyReviewFields = [
  'lastEditedAt',
  'editedByName',
  'editedBy',
  'moderationReason',
  'moderatedBy',
  'withdrawalReason',
  'withdrawnBy',
] as const

describe('Review versioning foundation', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.versioning.test.ts')
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

    const city = cities.docs[0]
    const treatment = treatments.docs[0]
    if (!city || !treatment) {
      throw new Error('Expected baseline city and treatment for review versioning tests')
    }

    cityId = city.id as number
    treatmentId = treatment.id as number
  }, 60000)

  afterEach(async () => {
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

  it('records unlimited native versions while access-controlled writes keep the foundation neutral', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-neutral`,
    })
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-neutral-platform`,
      createdStaffIds: staffIds,
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-neutral-patient`,
      createdPatientIds: patientIds,
    })
    const platformUser = asPayloadStaffUser(moderator)

    const created = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: 'Original versioned review text',
        publicMeasure: 'removed',
        publicComment: 'Spoofed public review text',
        publicNotice: 'Spoofed public notice',
        moderationReason: 'Spoofed moderation reason',
        moderatedAt: '2026-08-08T08:00:00.000Z',
        moderatedBy: moderator.id,
        withdrawalState: 'withdrawn',
        withdrawalSource: 'patient',
        withdrawalReason: 'Spoofed withdrawal reason',
        withdrawnAt: '2026-08-08T08:00:00.000Z',
        withdrawnBy: { relationTo: 'patients', value: patient.id },
      } as unknown as Review,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    reviewIds.push(created.id)

    expect(created.publicMeasure).toBe('none')
    expect(created.withdrawalState).toBe('active')
    expect(created.publicComment).toBeFalsy()
    expect(created.moderationReason).toBeFalsy()
    expect(created.withdrawalReason).toBeFalsy()

    const updated = await payload.update({
      collection: 'reviews',
      id: created.id,
      data: {
        comment: 'Updated versioned review text',
        publicMeasure: 'removed',
        withdrawalState: 'withdrawn',
      } as unknown as Review,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.comment).toBe('Updated versioned review text')
    expect(updated.publicMeasure).toBe('none')
    expect(updated.withdrawalState).toBe('active')

    const versions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: created.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })

    expect(versions.docs.length).toBeGreaterThanOrEqual(2)
    expect(versions.docs.map((entry) => entry.version.comment)).toEqual(
      expect.arrayContaining(['Original versioned review text', 'Updated versioned review text']),
    )
    expect(versions.docs.every((entry) => entry.version.publicMeasure === 'none')).toBe(true)
    expect(versions.docs.every((entry) => entry.version.withdrawalState === 'active')).toBe(true)

    await expect(
      payload.restoreVersion({
        collection: 'reviews',
        id: versions.docs[0]!.id,
        user: platformUser,
        overrideAccess: false,
      }),
    ).rejects.toThrow('immutable audit records')
  }, 60000)

  it('keeps removed and withdrawn reviews out of public reads while exposing only sanitized clinic state', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-private`,
    })
    const moderator = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-private-platform`,
      createdStaffIds: staffIds,
    })
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-private-patient`,
      createdPatientIds: patientIds,
    })
    const clinicStaff = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-private-clinic`,
      createdStaffIds: staffIds,
    })
    const platformUser = asPayloadStaffUser(moderator)
    const patientUser = asPayloadPatientUser(patient)
    const clinicUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinic.id)

    const review = await payload.create({
      collection: 'reviews',
      data: {
        patient: patient.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 5,
        comment: 'The existing public review contract remains unchanged',
        status: 'approved',
        lastEditedAt: '2026-08-08T08:30:00.000Z',
        editedByName: 'Internal Editor',
        editedBy: moderator.id,
        publicMeasure: 'removed',
        publicComment: null,
        publicNotice: null,
        moderationReason: 'Internal moderation evidence',
        moderatedAt: '2026-08-08T09:00:00.000Z',
        moderatedBy: moderator.id,
        withdrawalState: 'withdrawn',
        withdrawalSource: 'patient',
        withdrawalReason: 'Internal withdrawal evidence',
        withdrawnAt: '2026-08-08T09:00:00.000Z',
        withdrawnBy: { relationTo: 'patients', value: patient.id },
      } as unknown as Review,
      overrideAccess: true,
      depth: 0,
    })
    reviewIds.push(review.id)

    for (const user of [undefined, patientUser]) {
      const publicRead = await payload.find({
        collection: 'reviews',
        where: { id: { equals: review.id } },
        user,
        overrideAccess: false,
        depth: 0,
      })
      expect(publicRead.docs).toHaveLength(0)
    }

    const clinicRead = await payload.find({
      collection: 'reviews',
      where: { id: { equals: review.id } },
      user: clinicUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]).toMatchObject({
      publicMeasure: 'removed',
      moderatedAt: '2026-08-08T09:00:00.000Z',
      withdrawalState: 'withdrawn',
      withdrawalSource: 'patient',
      withdrawnAt: '2026-08-08T09:00:00.000Z',
    })
    expect(clinicRead.docs[0]).not.toHaveProperty('comment')
    expect(clinicRead.docs[0]).not.toHaveProperty('patient')
    for (const field of platformOnlyReviewFields) expect(clinicRead.docs[0]).not.toHaveProperty(field)

    const platformRead = await payload.findByID({
      collection: 'reviews',
      id: review.id,
      user: platformUser,
      overrideAccess: false,
      depth: 0,
    })
    expect(platformRead.publicMeasure).toBe('removed')
    expect(platformRead.withdrawalState).toBe('withdrawn')
    expect(platformRead.moderationReason).toBe('Internal moderation evidence')
    expect(platformRead.editedByName).toBe('Internal Editor')

    const platformVersions = await payload.findVersions({
      collection: 'reviews',
      where: { parent: { equals: review.id } },
      user: platformUser,
      overrideAccess: false,
      depth: 0,
      pagination: false,
    })
    expect(platformVersions.docs).toHaveLength(1)
    expect(platformVersions.docs[0]?.version.publicMeasure).toBe('removed')
    expect(platformVersions.docs[0]?.version.moderationReason).toBe('Internal moderation evidence')

    for (const user of [undefined, patientUser, clinicUser]) {
      await expect(
        payload.findVersions({
          collection: 'reviews',
          where: { parent: { equals: review.id } },
          user,
          overrideAccess: false,
          depth: 0,
          pagination: false,
        }),
      ).rejects.toThrow()
    }
  }, 60000)
})
