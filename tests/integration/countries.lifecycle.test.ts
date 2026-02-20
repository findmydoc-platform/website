import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { assertDeniedCrud } from '../fixtures/accessAssertions'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import {
  asPayloadBasicUser,
  asPayloadPatientUser,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
} from '../fixtures/testUsers'
import type { Country } from '@/payload-types'

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

  const createPlatformUser = (suffix: string) =>
    createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-${suffix}`,
      lastName: `User-${suffix}`,
    })

  const createPatientUser = (suffix: string) =>
    createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient-${suffix}`,
      lastName: `User-${suffix}`,
    })

  const createClinicUser = (suffix: string) =>
    createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-${suffix}`,
      lastName: `User-${suffix}`,
    })

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
    const clinicUser = await createClinicUser('access-clinic')
    const patientUser = await createPatientUser('access-patient')

    const platformCreated = await payload.create({
      collection: 'countries',
      data: {
        name: `${slugPrefix}-platform-write`,
        isoCode: 'ES',
        language: 'Spanish',
        currency: 'EUR',
      } as unknown as Country,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const deniedUsers = [
      {
        label: 'clinic',
        user: asPayloadBasicUser(clinicUser),
        createData: {
          name: `${slugPrefix}-clinic-write`,
          isoCode: 'NL',
          language: 'Dutch',
          currency: 'EUR',
        },
      },
      {
        label: 'patient',
        user: asPayloadPatientUser(patientUser),
        createData: {
          name: `${slugPrefix}-patient-write`,
          isoCode: 'IT',
          language: 'Italian',
          currency: 'EUR',
        },
      },
    ]

    await assertDeniedCrud(
      deniedUsers.map((deniedUser) => ({
        create: () =>
          payload.create({
            collection: 'countries',
            data: deniedUser.createData as unknown as Country,
            user: deniedUser.user,
            overrideAccess: false,
            depth: 0,
          }),
        update: () =>
          payload.update({
            collection: 'countries',
            id: platformCreated.id,
            data: { name: `${slugPrefix}-${deniedUser.label}-update` } as unknown as Country,
            user: deniedUser.user,
            overrideAccess: false,
            depth: 0,
          }),
        delete: () =>
          payload.delete({
            collection: 'countries',
            id: platformCreated.id,
            user: deniedUser.user,
            overrideAccess: false,
          }),
      })),
    )

    const updated = await payload.update({
      collection: 'countries',
      id: platformCreated.id,
      data: { name: `${slugPrefix}-platform-update` } as unknown as Country,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    expect(updated.name).toBe(`${slugPrefix}-platform-update`)

    const deleted = await payload.delete({
      collection: 'countries',
      id: platformCreated.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(deleted.id).toBe(platformCreated.id)
  })
})
