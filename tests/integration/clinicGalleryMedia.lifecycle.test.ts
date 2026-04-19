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
import { approveClinicStaff, asBasicUserPayload, createClinicUserWithStaff } from '../fixtures/clinicUserFixtures'
import { ClinicGalleryMedia as ClinicGalleryMediaCollection } from '@/collections/ClinicGalleryMedia'
import type { BasicUser, ClinicGalleryMedia } from '@/payload-types'

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
  const createdBasicUserIds: Array<number> = []

  const createPlatformUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-platform-${suffix}@example.com`,
        userType: 'platform',
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-platform-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    createdBasicUserIds.push(basicUser.id)
    return basicUser
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
      { collection: 'basicUsers', ids: createdBasicUserIds },
    ])

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates gallery media for a clinic with storage key and storage path', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'create',
      createdBasicUserIds,
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
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    expect(created.storageKey).toMatch(/^cgmedia-[a-f0-9]{32}$/)
    expect(created.storagePath).toMatch(new RegExp(`^clinics-gallery/${clinic.id}-cgmedia-[a-f0-9]{32}-.+\\.png$`))
  })

  it('auto-assigns clinic on create when clinic users omit the clinic field', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-auto-assign` })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'auto-assign',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Auto assign gallery media',
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-auto-assign.png`),
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)
    expect(created.clinic).toBe(clinic.id)
  })

  it('sets publishedAt when publishing', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-publish` })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'publish',
      createdBasicUserIds,
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
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'clinicGalleryMedia',
      id: created.id,
      data: { status: 'published' },
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.status).toBe('published')
    expect(updated.publishedAt).toBeTruthy()
  })

  it('prevents changing clinic or storageKey on update', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-b` })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'freeze',
      createdBasicUserIds,
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
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { clinic: clinicB.id },
        user: asBasicUserPayload(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/clinic ownership|assign records to another clinic/i)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { storageKey: 'cgmedia-manual' },
        user: asBasicUserPayload(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/storage key/i)
  })

  it('allows updating description without altering storageKey', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'update',
      createdBasicUserIds,
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
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
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
      user: asBasicUserPayload(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.storageKey).toBe(created.storageKey)
  })

  it('returns scoped gallery access for assigned clinic staff and denies unassigned or patient mutations', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-access` })
    const { basicUser, clinicStaff } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'access-assigned',
      createdBasicUserIds,
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const scopedRead = await ClinicGalleryMediaCollection.access!.read!({
      req: {
        payload,
        user: asBasicUserPayload(basicUser),
      } as unknown as PayloadRequest,
    })

    expect(scopedRead).toEqual({
      clinic: {
        equals: clinic.id,
      },
    })

    const { basicUser: unassignedClinicUser } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'access-unassigned',
      createdBasicUserIds,
      createdClinicStaffIds,
    })

    const deniedRead = await ClinicGalleryMediaCollection.access!.read!({
      req: {
        payload,
        user: asBasicUserPayload(unassignedClinicUser),
      } as unknown as PayloadRequest,
    })

    expect(deniedRead).toBe(false)

    const deniedClinicMutation = await ClinicGalleryMediaCollection.access!.update!({
      req: {
        payload,
        user: asBasicUserPayload(unassignedClinicUser),
      } as unknown as PayloadRequest,
    })

    expect(deniedClinicMutation).toBe(false)

    const deniedPatientMutation = await ClinicGalleryMediaCollection.access!.update!({
      req: {
        payload,
        user: { id: 500, collection: 'patients' },
      } as unknown as PayloadRequest,
    })

    expect(deniedPatientMutation).toBe(false)

    const platformUser = await createPlatformUser('access')
    const platformMutation = await ClinicGalleryMediaCollection.access!.update!({
      req: {
        payload,
        user: asBasicUserPayload(platformUser),
      } as unknown as PayloadRequest,
    })

    expect(platformMutation).toBe(true)
  })

  it('scopes reads to published for public, clinic for staff, and all for platform', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'read-a',
      createdBasicUserIds,
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, staffA.id, clinicA.id as number)

    const { basicUser: clinicUserB, clinicStaff: staffB } = await createClinicUserWithStaff(payload, {
      slugPrefix,
      suffix: 'read-b',
      createdBasicUserIds,
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, staffB.id, clinicB.id as number)

    const mediaA = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Clinic A draft',
        clinic: clinicA.id,
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-read-a.png`),
      user: asBasicUserPayload(clinicUserA),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia
    createdMediaIds.push(mediaA.id)

    const mediaB = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Clinic B published',
        clinic: clinicB.id,
        status: 'published',
      } as Partial<ClinicGalleryMedia>,
      file: createTinyPngFile(`${slugPrefix}-read-b.png`),
      user: asBasicUserPayload(clinicUserB),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia
    createdMediaIds.push(mediaB.id)

    const publicRead = await payload.find({
      collection: 'clinicGalleryMedia',
      overrideAccess: false,
      depth: 0,
    })

    const publicIds = publicRead.docs.map((doc) => doc.id)
    expect(publicIds).toContain(mediaB.id)
    expect(publicIds).not.toContain(mediaA.id)

    const clinicRead = await payload.find({
      collection: 'clinicGalleryMedia',
      user: asBasicUserPayload(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?.id).toBe(mediaA.id)

    const platformUser = await createPlatformUser('read')
    const platformRead = await payload.find({
      collection: 'clinicGalleryMedia',
      user: asBasicUserPayload(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const platformIds = platformRead.docs.map((doc) => doc.id)
    expect(platformIds).toEqual(expect.arrayContaining([mediaA.id, mediaB.id]))
  })
})
