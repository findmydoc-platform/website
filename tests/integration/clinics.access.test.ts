import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicStaff } from '@/payload-types'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'

describe('Clinics access integration', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinics.access.test.ts')
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic access tests')
    cityId = cityDoc.id as number
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('allows clinic staff to update their own clinic but not status', async () => {
    const clinic = await payload.create({
      collection: 'clinics',
      data: {
        name: `${slugPrefix}-clinic`,
        address: {
          street: 'Access Street',
          houseNumber: '10',
          zipCode: 12000,
          country: 'Turkey',
          city: cityId,
        },
        contact: {
          phoneNumber: '+90 555 1111111',
          email: `${slugPrefix}@example.com`,
        },
        supportedLanguages: ['english'],
        status: 'draft',
      },
      overrideAccess: true,
    })

    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-user@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'Staff',
        supabaseUserId: `sb-${slugPrefix}-clinic`,
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(basicUser.id)

    const staffRes = await payload.find({
      collection: 'clinicStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
    })
    const staffDoc = staffRes.docs[0] as ClinicStaff | undefined
    if (!staffDoc) throw new Error('Expected clinic staff profile')

    await payload.update({
      collection: 'clinicStaff',
      id: staffDoc.id,
      data: { clinic: clinic.id },
      overrideAccess: true,
    })

    const updated = await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { name: `${slugPrefix}-updated` },
      overrideAccess: false,
      user: { ...basicUser, collection: 'basicUsers' },
    })

    expect(updated.name).toBe(`${slugPrefix}-updated`)

    await expect(
      payload.update({
        collection: 'clinics',
        id: clinic.id,
        data: { status: 'approved' },
        overrideAccess: false,
        user: { ...basicUser, collection: 'basicUsers' },
      }),
    ).rejects.toThrow()
  })
})
