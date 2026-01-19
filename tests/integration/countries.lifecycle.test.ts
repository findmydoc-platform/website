import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient, Country } from '@/payload-types'

type PayloadUser = NonNullable<Parameters<Payload['update']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]

const asPayloadUser = (user: BasicUser): PayloadUser => {
  return { ...user, collection: 'basicUsers' } as unknown as PayloadUser
}

const asPatientUser = (user: Patient): PayloadUser => {
  return { ...user, collection: 'patients' } as unknown as PayloadUser
}

describe('Countries integration - lifecycle and access', () => {
  let payload: Payload
  const slugPrefix = testSlug('countries.lifecycle.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTestEntities(payload, 'countries', slugPrefix)
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

  it('creates a country with required fields', async () => {
    const created = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-country`,
        isoCode: 'TR',
        language: 'Turkish',
        currency: 'TRY',
      } as unknown as Country,
      overrideAccess: true,
      depth: 0,
    })

    expect(created.id).toBeDefined()
    expect(created.name).toBe(`${slugPrefix}-country`)
    expect(created.isoCode).toBe('TR')
    expect(created.language).toBe('Turkish')
    expect(created.currency).toBe('TRY')
  })

  it('updates country fields', async () => {
    const created = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-update`,
        isoCode: 'US',
        language: 'English',
        currency: 'USD',
      } as unknown as Country,
      overrideAccess: true,
      depth: 0,
    })

    const updated = await payload.update({
      collection: 'countries',
      id: created.id,
      data: {
        name: `${slugPrefix}-updated`,
        isoCode: 'GB',
        language: 'English (UK)',
        currency: 'GBP',
      } as unknown as Country,
      overrideAccess: true,
      depth: 0,
    })

    expect(updated.id).toBe(created.id)
    expect(updated.name).toBe(`${slugPrefix}-updated`)
    expect(updated.isoCode).toBe('GB')
    expect(updated.language).toBe('English (UK)')
    expect(updated.currency).toBe('GBP')
  })

  it('deletes a country and removes it from queries', async () => {
    const created = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-delete`,
        isoCode: 'DE',
        language: 'German',
        currency: 'EUR',
      } as unknown as Country,
      overrideAccess: true,
      depth: 0,
    })

    const deleted = await payload.delete({
      collection: 'countries',
      id: created.id,
      overrideAccess: true,
    })

    expect(deleted.id).toBe(created.id)

    const findResult = await payload.find({
      collection: 'countries',
      where: { id: { equals: created.id } },
      overrideAccess: true,
      depth: 0,
    })

    expect(findResult.docs).toHaveLength(0)
  })

  it('rejects missing required fields', async () => {
    await expect(
      payload.create({
        collection: 'countries',
        data: { name: `${slugPrefix}-invalid` },
        overrideAccess: true,
        depth: 0,
      } as unknown as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()
  })

  it('allows public read but restricts writes to platform users', async () => {
    const created = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-public-read`,
        isoCode: 'FR',
        language: 'French',
        currency: 'EUR',
      } as unknown as Country,
      overrideAccess: true,
      depth: 0,
    })

    const publicRead = await payload.find({
      collection: 'countries',
      where: { id: { equals: created.id } },
      overrideAccess: false,
      depth: 0,
    })

    expect(publicRead.docs).toHaveLength(1)
    expect(publicRead.docs[0]?.name).toBe(`${slugPrefix}-public-read`)

    const platformUser = await createPlatformUser('access-platform')
    const patientUser = await createPatientUser('access-patient')

    const platformCreated = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-platform-write`,
        isoCode: 'ES',
        language: 'Spanish',
        currency: 'EUR',
      } as unknown as Country,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    await expect(async () => {
      await payload.create({
        collection: 'countries',
        data: {
          name: `${slugPrefix}-patient-write`,
          isoCode: 'IT',
          language: 'Italian',
          currency: 'EUR',
        } as unknown as Country,
        user: asPatientUser(patientUser),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrow()

    await expect(async () => {
      await payload.update({
        collection: 'countries',
        id: platformCreated.id,
        data: { name: `${slugPrefix}-patient-update` } as unknown as Country,
        user: asPatientUser(patientUser),
        overrideAccess: false,
        depth: 0,
      })
    }).rejects.toThrow()

    const updated = await payload.update({
      collection: 'countries',
      id: platformCreated.id,
      data: { name: `${slugPrefix}-platform-update` } as unknown as Country,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.name).toBe(`${slugPrefix}-platform-update`)

    await expect(async () => {
      await payload.delete({
        collection: 'countries',
        id: platformCreated.id,
        user: asPatientUser(patientUser),
        overrideAccess: false,
      })
    }).rejects.toThrow()

    const deleted = await payload.delete({
      collection: 'countries',
      id: platformCreated.id,
      user: asPayloadUser(platformUser),
      overrideAccess: false,
    })

    expect(deleted.id).toBe(platformCreated.id)
  })
})
