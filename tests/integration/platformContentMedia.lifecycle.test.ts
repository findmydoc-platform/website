import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { randomUUID } from 'crypto'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { asBasicUserPayload } from '../fixtures/clinicUserFixtures'
import { createTinyPngFile } from '../fixtures/mediaFile'
import type { BasicUser, Patient, PlatformContentMedia } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

describe('PlatformContentMedia integration - lifecycle', () => {
  let payload: Payload
  const slugPrefix = testSlug('platformContentMedia.lifecycle.test.ts')
  const createdMediaIds: Array<number> = []
  const createdUserIds: Array<number> = []
  const createdPatientIds: Array<number> = []

  const uniqueSupabaseUserId = (suffix: string) => `${slugPrefix}-${suffix}-${randomUUID()}`

  const createPlatformUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        supabaseUserId: uniqueSupabaseUserId(suffix),
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    })) as BasicUser

    createdUserIds.push(basicUser.id)
    return basicUser
  }

  const createClinicUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-${suffix}@example.com`,
        supabaseUserId: uniqueSupabaseUserId(`clinic-${suffix}`),
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    })) as BasicUser

    createdUserIds.push(basicUser.id)
    return basicUser
  }

  const createPatientUser = async (suffix: string) => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-patient-${suffix}@example.com`,
        supabaseUserId: uniqueSupabaseUserId(`patient-${suffix}`),
        firstName: 'Patient',
        lastName: `User-${suffix}`,
      },
      overrideAccess: true,
    })) as Patient

    createdPatientIds.push(patient.id)
    return patient
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  })

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'platformContentMedia', ids: createdMediaIds },
      { collection: 'patients', ids: createdPatientIds },
      { collection: 'basicUsers', ids: createdUserIds },
    ])
  })

  it('creates media with createdBy and computed storage path', async () => {
    const platformUser = await createPlatformUser('create')

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Hero image',
      } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-hero.png`),
      user: asBasicUserPayload(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(platformUser.id)
    expect(created.filename).toMatch(/^[a-f0-9]{10}-.*\.png$/)
    expect(created.storagePath).toMatch(/^platform\/[a-f0-9]{10}-.*\.png$/)
  })

  it('updates metadata without changing createdBy', async () => {
    const platformUser = await createPlatformUser('update')

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: {
        alt: 'Before alt',
      } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-alt.png`),
      user: asBasicUserPayload(platformUser),
      draft: false,
      depth: 0,
      overrideAccess: false,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'platformContentMedia',
      id: created.id,
      data: {
        alt: 'After alt',
      },
      user: asBasicUserPayload(platformUser),
      depth: 0,
      overrideAccess: false,
    })) as PlatformContentMedia

    expect(updated.createdBy).toBe(platformUser.id)
    expect(updated.storagePath).toMatch(/^platform\/[a-f0-9]{10}-.*\.png$/)
  })

  it('allows public reads but blocks clinic, patient, and anonymous writes', async () => {
    const platformUser = await createPlatformUser('access')
    const clinicUser = await createClinicUser('access')
    const patientUser = await createPatientUser('access')

    const created = (await payload.create({
      collection: 'platformContentMedia',
      data: { alt: 'Public readable media' } as Partial<PlatformContentMedia>,
      file: createTinyPngFile(`${slugPrefix}-access.png`),
      user: asBasicUserPayload(platformUser),
      draft: false,
      overrideAccess: false,
      depth: 0,
    } as Parameters<Payload['create']>[0])) as PlatformContentMedia

    createdMediaIds.push(created.id)

    const publicRead = await payload.findByID({
      collection: 'platformContentMedia',
      id: created.id,
      overrideAccess: false,
      depth: 0,
    })

    expect(publicRead.id).toBe(created.id)

    await expect(
      payload.create({
        collection: 'platformContentMedia',
        data: { alt: 'Clinic create blocked' } as Partial<PlatformContentMedia>,
        file: createTinyPngFile(`${slugPrefix}-clinic-blocked.png`),
        user: asBasicUserPayload(clinicUser),
        draft: false,
        overrideAccess: false,
        depth: 0,
      } as Parameters<Payload['create']>[0]),
    ).rejects.toThrow()

    await expect(
      payload.update({
        collection: 'platformContentMedia',
        id: created.id,
        data: { alt: 'Patient update blocked' },
        user: { ...patientUser, collection: 'patients' } as NonNullable<Parameters<Payload['update']>[0]['user']>,
        overrideAccess: false,
        depth: 0,
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
})
