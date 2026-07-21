import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, PayloadRequest } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { approveClinicStaff, asStaffPayloadUser, createClinicStaffFixture } from '../fixtures/clinicUserFixtures'
import { ClinicGalleryMedia as ClinicGalleryMediaCollection } from '@/collections/ClinicGalleryMedia'
import type { ClinicGalleryMedia, PlatformStaff } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicGalleryMedia integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicGalleryMedia.lifecycle.test.ts')

  const createdMediaIds: Array<number> = []
  const createdClinicStaffIds: Array<number> = []
  const createdStaffIds: Array<number> = []

  const createPlatformUser = async (suffix: string) => {
    const platformStaff = (await payload.create({
      collection: 'platformStaff',
      data: {
        email: `${slugPrefix}-platform-${suffix}@findmydoc.eu`,
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        role: 'support',
        supabaseUserId: `sb-${slugPrefix}-platform-${suffix}`,
      },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as PlatformStaff

    createdStaffIds.push(platformStaff.id)
    return platformStaff
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic gallery media tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'clinicGalleryMedia', ids: createdMediaIds },
      { collection: 'clinicStaff', ids: createdClinicStaffIds },
      { collection: 'platformStaff', ids: createdStaffIds },
    ])

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates gallery media for a clinic with storage key and storage path', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'create',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Gallery image',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-gallery.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    expect(created.storageKey).toMatch(/^cgmedia-[a-f0-9]{32}$/)
    expect(created.storagePath).toMatch(new RegExp(`^clinics-gallery/${clinic.id}-cgmedia-[a-f0-9]{32}-.+\\.png$`))
  })

  it('returns the gallery format contract for unsupported or invalid direct uploads', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-invalid-upload` })
    const platformUser = await createPlatformUser('invalid-upload')
    const acceptedFormatsMessage = 'Unsupported image format. Accepted formats: JPG, PNG, WebP, AVIF, GIF.'

    await expect(
      payload.create({
        collection: 'clinicGalleryMedia',
        data: {
          alt: 'Unsupported gallery image',
          clinic: clinic.id,
        } as Partial<ClinicGalleryMedia>,
        file: {
          data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
          mimetype: 'image/svg+xml',
          name: `${slugPrefix}-unsupported.svg`,
          size: 46,
        },
        user: asStaffPayloadUser(platformUser),
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(acceptedFormatsMessage)

    await expect(
      payload.create({
        collection: 'clinicGalleryMedia',
        data: {
          alt: 'Invalid gallery image',
          clinic: clinic.id,
        } as Partial<ClinicGalleryMedia>,
        file: {
          data: Buffer.from('not an image'),
          mimetype: 'image/png',
          name: `${slugPrefix}-invalid.png`,
          size: 12,
        },
        user: asStaffPayloadUser(platformUser),
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(acceptedFormatsMessage)
  })

  it('auto-assigns clinic on create when clinic users omit the clinic field', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-auto-assign` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'auto-assign',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Auto assign gallery media',
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-auto-assign.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)
    expect(created.clinic).toBe(clinic.id)
  })

  it('sets publishedAt when publishing', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-publish` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'publish',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Publish media',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-publish.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'clinicGalleryMedia',
      id: created.id,
      data: { status: 'published' },
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.status).toBe('published')
    expect(updated.publishedAt).toBeTruthy()
  })

  it('prevents changing clinic or storageKey on update', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-b` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'freeze',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinicA.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Freeze media',
        clinic: clinicA.id,
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-freeze.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { clinic: clinicB.id },
        user: asStaffPayloadUser(staffUser),
        overrideAccess: true,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/clinic ownership|assign records to another clinic/i)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { storageKey: 'cgmedia-manual' },
        user: asStaffPayloadUser(staffUser),
        overrideAccess: true,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/storage key/i)
  })

  it('allows updating description without altering storageKey', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'update',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Before description',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-update.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'clinicGalleryMedia',
      id: created.id,
      data: {
        description: {
          root: {
            type: 'root',
            children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Updated description' }] }],
            direction: 'ltr',
            format: '',
            indent: 0,
            version: 1,
          },
        },
      },
      user: asStaffPayloadUser(staffUser),
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.storageKey).toBe(created.storageKey)
  })

  it('denies regular gallery media access for every principal', async () => {
    const accessOperations = ['admin', 'read', 'create', 'update', 'delete'] as const

    for (const operation of accessOperations) {
      expect(
        await ClinicGalleryMediaCollection.access![operation]!({
          req: {
            payload,
            user: null,
          } as unknown as PayloadRequest,
        } as never),
      ).toBe(false)
    }
  })
})
