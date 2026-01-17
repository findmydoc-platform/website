import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient, PlatformStaff } from '@/payload-types'

async function createPlatformStaff(payload: Payload, email: string) {
  const basicUser = (await payload.create({
    collection: 'basicUsers',
    data: {
      email,
      userType: 'platform',
      firstName: 'Review',
      lastName: 'Owner',
      supabaseUserId: `sb-${email}`,
    },
    overrideAccess: true,
  })) as BasicUser

  const staffRes = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })

  const staffDoc = staffRes.docs[0] as PlatformStaff | undefined
  if (!staffDoc) throw new Error('Expected platform staff profile for review')

  return { basicUser, staffDoc }
}

describe('Reviews validation and access', () => {
  let payload: Payload
  let cityId: number
  let treatmentId: number
  const slugPrefix = testSlug('reviews.validationAccess.test.ts')
  const createdBasicUserIds: Array<number | string> = []
  const createdReviewIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for review validation tests')
    cityId = cityDoc.id as number

    const treatmentRes = await payload.find({ collection: 'treatments', limit: 1, overrideAccess: true })
    const treatmentDoc = treatmentRes.docs[0]
    if (!treatmentDoc) throw new Error('Expected baseline treatment for review validation tests')
    treatmentId = treatmentDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    while (createdReviewIds.length) {
      const id = createdReviewIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'reviews', id, overrideAccess: true })
    }
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
    await cleanupTestEntities(payload, 'doctors', slugPrefix)

    const { docs } = await payload.find({
      collection: 'patients',
      where: { email: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'patients', id: doc.id, overrideAccess: true })
    }
  })

  it('validates required relationships and rating bounds', async () => {
    const { basicUser, staffDoc } = await createPlatformStaff(payload, `${slugPrefix}-reviewer@example.com`)
    createdBasicUserIds.push(basicUser.id)

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: staffDoc.id,
          starRating: 5,
          comment: 'Missing relations',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()

    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Review Street',
          houseNumber: '1',
          zipCode: 12000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
      },
      overrideAccess: true,
    })

    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-Doc`,
        lastName: 'Review',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    await expect(
      payload.create({
        collection: 'reviews',
        data: {
          patient: staffDoc.id,
          clinic: clinic.id,
          doctor: doctor.id,
          treatment: treatmentId,
          starRating: 6,
          comment: 'Invalid rating',
          status: 'pending',
        },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('sets reviewDate by default and blocks patient updates', async () => {
    const { basicUser, staffDoc } = await createPlatformStaff(payload, `${slugPrefix}-editor@example.com`)
    createdBasicUserIds.push(basicUser.id)

    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic-update`,
        address: {
          street: 'Review Street',
          houseNumber: '2',
          zipCode: 12000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}-update@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'approved',
      },
      overrideAccess: true,
    })

    const doctor = await payload.create({
      collection: 'doctors',
      data: {
        firstName: `${slugPrefix}-Doc`,
        lastName: 'Review',
        clinic: clinic.id,
        qualifications: ['MD'],
        languages: ['english'],
      },
      overrideAccess: true,
    })

    const review = await payload.create({
      collection: 'reviews',
      data: {
        patient: staffDoc.id,
        clinic: clinic.id,
        doctor: doctor.id,
        treatment: treatmentId,
        starRating: 4,
        comment: `${slugPrefix} review content`,
        status: 'pending',
      },
      overrideAccess: true,
    })
    createdReviewIds.push(review.id)

    expect(review.reviewDate).toBeTruthy()

    const patientUser = (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}@patient.com`,
        firstName: 'Patient',
        lastName: 'Reviewer',
        supabaseUserId: `sb-${slugPrefix}-patient`,
      },
      overrideAccess: true,
    })) as Patient

    await expect(
      payload.update({
        collection: 'reviews',
        id: review.id,
        data: { comment: 'Patient edit attempt' },
        overrideAccess: false,
        user: { ...patientUser, collection: 'patients' },
      }),
    ).rejects.toThrow()
  })
})
