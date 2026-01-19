import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicGalleryMedia, ClinicStaff } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicGalleryMedia integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicGalleryMedia.lifecycle.test.ts')

  const createdMediaIds: Array<number> = []
  const createdClinicStaffIds: Array<number> = []
  const createdBasicUserIds: Array<number> = []

  const buildImageFile = (name: string): File => {
    const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII='
    const data = Buffer.from(base64, 'base64')

    return {
      name,
      data,
      mimetype: 'image/png',
      size: data.length,
    }
  }

  const asClinicUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser
  const asPlatformUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser

  const createClinicUser = async (suffix: string) => {
    const basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: `${slugPrefix}-clinic-${suffix}@example.com`,
        userType: 'clinic',
        firstName: 'Clinic',
        lastName: `User-${suffix}`,
        supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as BasicUser

    createdBasicUserIds.push(basicUser.id)

    const clinicStaffResult = await payload.find({
      collection: 'clinicStaff',
      where: { user: { equals: basicUser.id } },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const clinicStaff = clinicStaffResult.docs[0] as ClinicStaff | undefined
    if (!clinicStaff) throw new Error('Expected clinic staff profile to be created')

    createdClinicStaffIds.push(clinicStaff.id)

    return { basicUser, clinicStaff }
  }

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

  const approveClinicStaff = async (clinicStaffId: number, clinicId: number) => {
    return (await payload.update({
      collection: 'clinicStaff',
      id: clinicStaffId,
      data: { clinic: clinicId, status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicStaff
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
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'clinicGalleryMedia', id, overrideAccess: true })
    }

    while (createdClinicStaffIds.length) {
      const id = createdClinicStaffIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true })
    }

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates gallery media for a clinic with storage key and storage path', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { basicUser, clinicStaff } = await createClinicUser('create')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Gallery image',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-gallery.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    expect(created.storageKey).toMatch(/^cgmedia-[a-f0-9]{32}$/)
    expect(created.storagePath).toMatch(new RegExp(`^clinics-gallery/${clinic.id}/cgmedia-[a-f0-9]{32}/.+\\.png$`))
  })

  it('sets publishedAt when publishing', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-publish` })
    const { basicUser, clinicStaff } = await createClinicUser('publish')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Publish media',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-publish.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'clinicGalleryMedia',
      id: created.id,
      data: { status: 'published' },
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.status).toBe('published')
    expect(updated.publishedAt).toBeTruthy()
  })

  it('prevents changing clinic or storageKey on update', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-b` })
    const { basicUser, clinicStaff } = await createClinicUser('freeze')

    await approveClinicStaff(clinicStaff.id, clinicA.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Freeze media',
        clinic: clinicA.id,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-freeze.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { clinic: clinicB.id },
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/clinic ownership/i)

    await expect(async () => {
      await payload.update({
        collection: 'clinicGalleryMedia',
        id: created.id,
        data: { storageKey: 'cgmedia-manual' },
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/storage key/i)
  })

  it('allows updating description without altering storageKey', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { basicUser, clinicStaff } = await createClinicUser('update')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Before description',
        clinic: clinic.id,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-update.png`),
      user: asClinicUser(basicUser),
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
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryMedia

    expect(updated.storageKey).toBe(created.storageKey)
  })

  it('scopes reads to published for public, clinic for staff, and all for platform', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUser('read-a')
    await approveClinicStaff(staffA.id, clinicA.id as number)

    const { basicUser: clinicUserB, clinicStaff: staffB } = await createClinicUser('read-b')
    await approveClinicStaff(staffB.id, clinicB.id as number)

    const mediaA = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: 'Clinic A draft',
        clinic: clinicA.id,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-read-a.png`),
      user: asClinicUser(clinicUserA),
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
      file: buildImageFile(`${slugPrefix}-read-b.png`),
      user: asClinicUser(clinicUserB),
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
      user: asClinicUser(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    expect(clinicRead.docs).toHaveLength(1)
    expect(clinicRead.docs[0]?.id).toBe(mediaA.id)

    const platformUser = await createPlatformUser('read')
    const platformRead = await payload.find({
      collection: 'clinicGalleryMedia',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const platformIds = platformRead.docs.map((doc) => doc.id)
    expect(platformIds).toEqual(expect.arrayContaining([mediaA.id, mediaB.id]))
  })
})
