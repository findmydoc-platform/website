import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['update']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]

const asPayloadUser = (user: BasicUser): PayloadUser => {
  return { ...user, collection: 'basicUsers' } as unknown as PayloadUser
}

const asPatientUser = (user: Patient): PayloadUser => {
  return { ...user, collection: 'patients' } as unknown as PayloadUser
}

describe('Cities Integration Tests (Clinic Dependency)', () => {
  let payload: Payload
  const slugPrefix = testSlug('cities.creation.test.ts')
  let countryId: number

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    // Get baseline country for city creation
    const countryRes = await payload.find({ collection: 'countries', limit: 1, overrideAccess: true, depth: 0 })
    const countryDoc = countryRes.docs[0]
    if (!countryDoc) throw new Error('Expected baseline country for city creation tests')
    countryId = countryDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTestEntities(payload, 'cities', slugPrefix)
    await payload.delete({
      collection: 'basicUsers',
      where: { email: { like: `${slugPrefix}%` } },
      overrideAccess: true,
    })
    await payload.delete({
      collection: 'patients',
      where: { email: { like: `${slugPrefix}%` } },
      overrideAccess: true,
    })
  })

  const createPlatformUser = async (suffix: string) => {
    return (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    } as PayloadCreateArgs)) as unknown as BasicUser
  }

  const createPatientUser = async (suffix: string) => {
    return (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-patient-${suffix}@example.com`,
        firstName: 'Patient',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    } as PayloadCreateArgs)) as unknown as Patient
  }

  it('creates a city with all required fields', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-test-city`,
        airportcode: 'TST',
        coordinates: [41.0082, 28.9784],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city.id).toBeDefined()
    expect(city.name).toBe(`${slugPrefix}-test-city`)
    expect(city.airportcode).toBe('TST')
    expect(city.coordinates).toEqual([41.0082, 28.9784])
    expect(city.country).toBe(countryId)
  })

  it('creates a city without airport code (optional field)', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-no-airport`,
        coordinates: [39.9334, 32.8597],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city.id).toBeDefined()
    expect(city.name).toBe(`${slugPrefix}-no-airport`)
    expect(city.airportcode ?? null).toBeNull()
    expect(city.coordinates).toEqual([39.9334, 32.8597])
  })

  it('validates required fields when creating a city', async () => {
    await expect(
      payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-invalid-city`,
          // Missing required coordinates and country
        },
        overrideAccess: true,
        depth: 0,
      } as unknown as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })

  it('validates coordinates format', async () => {
    await expect(
      payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-invalid-coords`,
          coordinates: 'invalid' as unknown as [number, number], // Invalid coordinates format
          country: countryId,
        },
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })

  it('updates city information', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-update-city`,
        coordinates: [40.0, 30.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    const updatedCity = await payload.update({
      collection: 'cities',
      id: city.id,
      data: {
        name: `${slugPrefix}-updated-city`,
        airportcode: 'UPD',
        coordinates: [40.5, 30.5],
      },
      overrideAccess: true,
      depth: 0,
    })

    const refreshedCity = await payload.findByID({
      collection: 'cities',
      id: city.id,
      overrideAccess: true,
      depth: 0,
    })

    expect(updatedCity.id).toBe(city.id)
    expect(updatedCity.name).toBe(`${slugPrefix}-updated-city`)
    expect(updatedCity.airportcode).toBe('UPD')
    expect(refreshedCity.coordinates).toEqual([40.5, 30.5])
  })

  it('allows anyone to read cities (public access)', async () => {
    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-public-city`,
        coordinates: [41.0, 29.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    // Query without overrideAccess to test public read access
    const result = await payload.find({
      collection: 'cities',
      where: { id: { equals: city.id } },
      depth: 0,
    })

    expect(result.docs).toHaveLength(1)
    expect(result.docs[0]?.name).toBe(`${slugPrefix}-public-city`)
  })

  it('enforces platform-only create, update, and delete access', async () => {
    const platformUser = await createPlatformUser('access-platform')
    const patientUser = await createPatientUser('access-patient')

    const city = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-access-city`,
        coordinates: [41.1, 29.1],
        country: countryId,
      },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    await expect(async () => {
      await payload.create({
        collection: 'cities',
        data: {
          name: `${slugPrefix}-access-denied-create`,
          coordinates: [41.2, 29.2],
          country: countryId,
        },
        user: asPatientUser(patientUser),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrow()

    await expect(async () => {
      await payload.update({
        collection: 'cities',
        id: city.id,
        data: { name: `${slugPrefix}-patient-update` },
        user: asPatientUser(patientUser),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrow()

    const updated = await payload.update({
      collection: 'cities',
      id: city.id,
      data: { name: `${slugPrefix}-platform-update` },
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.name).toBe(`${slugPrefix}-platform-update`)

    await expect(async () => {
      await payload.delete({
        collection: 'cities',
        id: city.id,
        user: asPatientUser(patientUser),
        overrideAccess: false,
      })
    }).rejects.toThrow()

    const deleted = await payload.delete({
      collection: 'cities',
      id: city.id,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
    })

    expect(deleted.id).toBe(city.id)
  })

  it('creates multiple cities with different airport codes', async () => {
    const city1 = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-city-1`,
        airportcode: 'CT1',
        coordinates: [41.0, 28.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    const city2 = await payload.create({
      collection: 'cities',
      data: {
        name: `${slugPrefix}-city-2`,
        airportcode: 'CT2',
        coordinates: [42.0, 29.0],
        country: countryId,
      },
      overrideAccess: true,
      depth: 0,
    })

    expect(city1.id).toBeDefined()
    expect(city2.id).toBeDefined()
    expect(city1.airportcode).toBe('CT1')
    expect(city2.airportcode).toBe('CT2')
  })
})
