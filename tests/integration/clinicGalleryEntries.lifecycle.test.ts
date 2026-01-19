import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicGalleryEntry, ClinicGalleryMedia, ClinicStaff } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicGalleryEntries integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicGalleryEntries.lifecycle.test.ts')

  const createdEntryIds: Array<number> = []
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

  const createGalleryMedia = async (
    clinicId: number,
    user: BasicUser,
    suffix: string,
    status: ClinicGalleryMedia['status'] = 'draft',
  ) => {
    const created = (await payload.create({
      collection: 'clinicGalleryMedia',
      data: {
        alt: `Gallery ${suffix}`,
        clinic: clinicId,
        status,
      } as Partial<ClinicGalleryMedia>,
      file: buildImageFile(`${slugPrefix}-${suffix}.png`),
      user: asClinicUser(user),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryMedia

    createdMediaIds.push(created.id)
    return created
  }

  const createEntry = async (params: {
    clinicId: number
    user: BasicUser
    beforeMediaId: number
    afterMediaId: number
    status?: ClinicGalleryEntry['status']
    titleSuffix: string
  }) => {
    const created = (await payload.create({
      collection: 'clinicGalleryEntries',
      data: {
        clinic: params.clinicId,
        title: `${slugPrefix}-${params.titleSuffix}`,
        beforeMedia: params.beforeMediaId,
        afterMedia: params.afterMediaId,
        status: params.status ?? 'draft',
      } as Partial<ClinicGalleryEntry>,
      user: asClinicUser(params.user),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicGalleryEntry

    createdEntryIds.push(created.id)
    return created
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic gallery entry tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdEntryIds.length) {
      const id = createdEntryIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'clinicGalleryEntries', id, overrideAccess: true })
    }

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

  it('creates a draft entry when media belongs to the same clinic', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { basicUser, clinicStaff } = await createClinicUser('create')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const before = await createGalleryMedia(clinic.id as number, basicUser, 'before-draft')
    const after = await createGalleryMedia(clinic.id as number, basicUser, 'after-draft')

    const entry = await createEntry({
      clinicId: clinic.id as number,
      user: basicUser,
      beforeMediaId: before.id,
      afterMediaId: after.id,
      titleSuffix: 'draft-entry',
    })

    expect(entry.status).toBe('draft')
    expect(entry.clinic).toBe(clinic.id)
    expect(entry.beforeMedia).toBe(before.id)
    expect(entry.afterMedia).toBe(after.id)
    expect(entry.createdBy).toBe(basicUser.id)
  })

  it('sets publishedAt when publishing an entry', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-publish` })
    const { basicUser, clinicStaff } = await createClinicUser('publish')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const before = await createGalleryMedia(clinic.id as number, basicUser, 'before-published', 'published')
    const after = await createGalleryMedia(clinic.id as number, basicUser, 'after-published', 'published')

    const entry = await createEntry({
      clinicId: clinic.id as number,
      user: basicUser,
      beforeMediaId: before.id,
      afterMediaId: after.id,
      titleSuffix: 'publish-entry',
    })

    const updated = (await payload.update({
      collection: 'clinicGalleryEntries',
      id: entry.id,
      data: { status: 'published' },
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicGalleryEntry

    expect(updated.status).toBe('published')
    expect(updated.publishedAt).toBeTruthy()
  })

  it('scopes reads to published for public, clinic for staff, and all for platform', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-read-b` })

    const { basicUser: clinicUserA, clinicStaff: staffA } = await createClinicUser('read-a')
    await approveClinicStaff(staffA.id, clinicA.id as number)

    const { basicUser: clinicUserB, clinicStaff: staffB } = await createClinicUser('read-b')
    await approveClinicStaff(staffB.id, clinicB.id as number)

    const beforeA = await createGalleryMedia(clinicA.id as number, clinicUserA, 'read-a-before')
    const afterA = await createGalleryMedia(clinicA.id as number, clinicUserA, 'read-a-after')
    const entryA = await createEntry({
      clinicId: clinicA.id as number,
      user: clinicUserA,
      beforeMediaId: beforeA.id,
      afterMediaId: afterA.id,
      titleSuffix: 'read-a-entry',
    })

    const beforeB = await createGalleryMedia(clinicB.id as number, clinicUserB, 'read-b-before', 'published')
    const afterB = await createGalleryMedia(clinicB.id as number, clinicUserB, 'read-b-after', 'published')
    const entryB = await createEntry({
      clinicId: clinicB.id as number,
      user: clinicUserB,
      beforeMediaId: beforeB.id,
      afterMediaId: afterB.id,
      status: 'published',
      titleSuffix: 'read-b-entry',
    })

    const publicRead = await payload.find({
      collection: 'clinicGalleryEntries',
      overrideAccess: false,
      depth: 0,
    })

    const publicIds = publicRead.docs.map((doc) => doc.id)
    expect(publicIds).toContain(entryB.id)
    expect(publicIds).not.toContain(entryA.id)

    const clinicRead = await payload.find({
      collection: 'clinicGalleryEntries',
      user: asClinicUser(clinicUserA),
      overrideAccess: false,
      depth: 0,
    })

    const clinicIds = clinicRead.docs.map((doc) => doc.id)
    expect(clinicIds).toContain(entryA.id)
    expect(clinicIds).not.toContain(entryB.id)

    const platformUser = await createPlatformUser('read')
    const platformRead = await payload.find({
      collection: 'clinicGalleryEntries',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const platformIds = platformRead.docs.map((doc) => doc.id)
    expect(platformIds).toEqual(expect.arrayContaining([entryA.id, entryB.id]))
  })
})
