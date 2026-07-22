import { describe, expect, it, beforeAll, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../../fixtures/ensureBaseline'
import {
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  createPlatformTestUser,
  asPayloadStaffUser,
  asPayloadPatientUser,
} from '../../fixtures/testUsers'
import { createTinyPngFile } from '../../fixtures/mediaFile'
import { testSlug } from '../../fixtures/testSlug'
import type { PlatformContentMedia } from '@/payload-types'

describe('PlatformContentMedia access', () => {
  let payload: Payload
  const slugPrefix = testSlug('media-access.test.ts')
  const createdMediaIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
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

    await cleanupTrackedUsers(payload, { staffIds: createdStaffIds, patientIds: createdPatientIds })
  })

  it('allows platform users to manage media entries', async () => {
    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform`,
      createdStaffIds,
      firstName: 'Media',
      lastName: 'Owner',
    })

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-hero` } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-hero.png`),
      user: asPayloadStaffUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(platformUser.id)
    expect(created.storagePath).toMatch(/^platform\//)

    const updated = (await payload.update({
      collection: 'platformContentMedia',
      id: created.id,
      data: { alt: 'updated alt' },
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
    })) as PlatformContentMedia

    expect(updated.alt).toBe('updated alt')

    await payload.delete({
      collection: 'platformContentMedia',
      id: created.id,
      user: asPayloadStaffUser(platformUser),
      overrideAccess: false,
    })

    createdMediaIds.pop()
  })

  it('blocks clinic and anonymous requests from creating, updating, or deleting media', async () => {
    const clinicUser = await createClinicTestUser(payload, {
      emailPrefix: `${slugPrefix}-clinic`,
      createdStaffIds,
    })

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: { alt: `${slugPrefix}-blocked` } as Partial<PlatformContentMedia>,
        file: createTinyPngFile(`${slugPrefix}-blocked.png`),
        user: asPayloadStaffUser(clinicUser),
        draft: false,
        overrideAccess: false,
      } as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: { alt: `${slugPrefix}-anonymous-blocked` } as Partial<PlatformContentMedia>,
        file: createTinyPngFile(`${slugPrefix}-anonymous-blocked.png`),
        draft: false,
        overrideAccess: false,
      } as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()

    const platformUser = await createPlatformTestUser(payload, {
      emailPrefix: `${slugPrefix}-platform-mutation`,
      createdStaffIds,
    })

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-mutable` } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-mutable.png`),
      user: asPayloadStaffUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    await expect(
      payload.update({
        collection: 'platformContentMedia',
        id: created.id,
        data: { alt: `${slugPrefix}-clinic-update-blocked` },
        user: asPayloadStaffUser(clinicUser),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    await expect(
      payload.delete({
        collection: 'platformContentMedia',
        id: created.id,
        user: asPayloadStaffUser(clinicUser),
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
      createdStaffIds,
    })

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: { alt: `${slugPrefix}-public` } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-public.png`),
      user: asPayloadStaffUser(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

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
      createdStaffIds,
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
      user: asPayloadStaffUser(clinicUser),
      overrideAccess: false,
    })

    expect(clinicRead.id).toBe(created.id)
  })
})
