import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'

import { ensureBaseline } from '../../fixtures/ensureBaseline'
import { cleanupTrackedUsers, createClinicTestUser, createPatientTestUser, createPlatformTestUser, asPayloadBasicUser, asPayloadPatientUser } from '../../fixtures/testUsers'
import { createTinyPngFile } from '../../fixtures/mediaFile'
import { testSlug } from '../../fixtures/testSlug'

describe('PlatformContentMedia access', () => {
  let payload: Payload
  const slugPrefix = testSlug('media-access.test.ts')
  const createdMediaIds: Array<number | string> = []
  const createdBasicUserIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'platformContentMedia', id, overrideAccess: true })
      } catch {}
    }

    await cleanupTrackedUsers(payload, { basicUserIds: createdBasicUserIds, patientIds: createdPatientIds })
  })

  it('allows platform users to manage media entries', async () => {
    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdBasicUserIds,
      firstName: 'Media',
      lastName: 'Owner',
    })

    const created = await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-hero` },
      file: createTinyPngFile(`${slugPrefix}-hero.png`),
      user: asPayloadBasicUser(platformUser),
      depth: 0,
      overrideAccess: false,
    })

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(platformUser.id)
    expect(created.storagePath).toMatch(/^platform\//)

    const updated = await payload.update({
      collection: 'platformContentMedia',
      id: created.id,
      data: { alt: 'updated alt' },
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    expect(updated.alt).toBe('updated alt')

    await payload.delete({
      collection: 'platformContentMedia',
      id: created.id,
      user: asPayloadBasicUser(platformUser),
      overrideAccess: false,
    })

    createdMediaIds.pop()
  })

  it('blocks clinic and anonymous requests from creating, updating, or deleting media', async () => {
    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic`,
      createdBasicUserIds,
    })

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: { alt: `${slugPrefix}-blocked` },
        file: createTinyPngFile(`${slugPrefix}-blocked.png`),
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: { alt: `${slugPrefix}-anonymous-blocked` },
        file: createTinyPngFile(`${slugPrefix}-anonymous-blocked.png`),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-mutation`,
      createdBasicUserIds,
    })

    const created = await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-mutable` },
      file: createTinyPngFile(`${slugPrefix}-mutable.png`),
      user: asPayloadBasicUser(platformUser),
      depth: 0,
      overrideAccess: false,
    })

    createdMediaIds.push(created.id)

    await expect(
      payload.update({
        collection: 'platformContentMedia',
        id: created.id,
        data: { alt: `${slugPrefix}-clinic-update-blocked` },
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'platformContentMedia',
        id: created.id,
        user: asPayloadBasicUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'platformContentMedia',
        id: created.id,
        data: { alt: `${slugPrefix}-anonymous-update-blocked` },
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'platformContentMedia',
        id: created.id,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
  })

  it('allows anyone to read platform media', async () => {
    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-read`,
      createdBasicUserIds,
    })

    const created = await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-public` },
      file: createTinyPngFile(`${slugPrefix}-public.png`),
      user: asPayloadBasicUser(platformUser),
      depth: 0,
      overrideAccess: false,
    })

    createdMediaIds.push(created.id)

    const anonymousRead = await payload.findByID({
      collection: 'platformContentMedia',
      id: created.id,
      overrideAccess: false,
    })

    expect(anonymousRead.id).toBe(created.id)

    const patientUser = await createPatientTestUser(payload, {
      emailPrefix: `${slugPrefix}-patient`,
      createdPatientIds,
    })

    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic-reader`,
      createdBasicUserIds,
    })

    const patientRead = await payload.findByID({
      collection: 'platformContentMedia',
      id: created.id,
      user: asPayloadPatientUser(patientUser),
      overrideAccess: false,
    })

    expect(patientRead.id).toBe(created.id)

    const clinicRead = await payload.findByID({
      collection: 'platformContentMedia',
      id: created.id,
      user: asPayloadBasicUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.id).toBe(created.id)
  })
})
