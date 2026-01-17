import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser } from '@/payload-types'

describe('Cities access integration', () => {
  let payload: Payload
  let countryId: number
  const slugPrefix = testSlug('cities.access.test.ts')
  const createdBasicUserIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const countryRes = await payload.find({ collection: 'countries', limit: 1, overrideAccess: true })
    const countryDoc = countryRes.docs[0]
    if (!countryDoc) throw new Error('Expected baseline country for city access tests')
    countryId = countryDoc.id as number
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    const { docs } = await payload.find({
      collection: 'cities',
      where: { name: { like: `${slugPrefix}%` } },
      limit: 100,
      overrideAccess: true,
    })
    for (const doc of docs) {
      await payload.delete({ collection: 'cities', id: doc.id, overrideAccess: true })
    }
  })

  it('blocks non-platform create and update', async () => {
    await expect(
      payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-city`,
          coordinates: [40, 29],
          country: countryId,
        },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-platform`,
        coordinates: [40, 29],
        country: countryId,
      },
      overrideAccess: true,
    })

    const clinicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-user@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: 'User',
        supabaseUserId: `sb-${slugPrefix}-clinic`,
      },
      overrideAccess: true,
    })) as BasicUser
    createdBasicUserIds.push(clinicUser.id)

    await expect(
      payload.update({
        collection: 'cities',
        id: city.id,
        data: { name: `${slugPrefix}-updated` },
        overrideAccess: false,
        user: { ...clinicUser, collection: 'basicUsers' },
      }),
    ).rejects.toThrow()
  })
})
