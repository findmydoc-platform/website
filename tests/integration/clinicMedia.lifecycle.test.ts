import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File, PayloadRequest, Where } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicMedia, ClinicStaff } from '@/payload-types'
import { ClinicMedia as ClinicMediaCollection } from '@/collections/ClinicMedia'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicMedia integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicMedia.lifecycle.test.ts')

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
    if (!cityDoc) throw new Error('Expected baseline city for clinic media tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'clinicMedia', id, overrideAccess: true })
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

  it('creates clinic media for own clinic with createdBy and storage path', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { basicUser, clinicStaff } = await createClinicUser('create')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic hero',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-clinic.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(basicUser.id)
    expect(created.storagePath).toMatch(new RegExp(`^clinics/${clinic.id}-[a-f0-9]{10}-.+\\.png$`))
  })

  it('blocks clinic users from uploading for another clinic', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-b` })

    const { basicUser, clinicStaff } = await createClinicUser('blocked')
    await approveClinicStaff(clinicStaff.id, clinicA.id as number)

    await expect(async () => {
      await payload.create({
        collection: 'clinicMedia',
        data: {
          alt: 'Wrong clinic',
          clinic: clinicB.id,
        } as Partial<ClinicMedia>,
        file: buildImageFile(`${slugPrefix}-blocked.png`),
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('prevents changing clinic ownership on update', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-b` })

    const { basicUser, clinicStaff } = await createClinicUser('freeze')
    await approveClinicStaff(clinicStaff.id, clinicA.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic media',
        clinic: clinicA.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-freeze.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'clinicMedia',
        id: created.id,
        data: { clinic: clinicB.id },
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/clinic ownership/i)
  })

  it('updates metadata without altering createdBy or storagePath', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { basicUser, clinicStaff } = await createClinicUser('update')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Before alt',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-update.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'clinicMedia',
      id: created.id,
      data: {
        alt: 'After alt',
      },
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicMedia

    expect(updated.createdBy).toBe(basicUser.id)
    expect(updated.storagePath).toMatch(new RegExp(`^clinics/${clinic.id}-(\\d+|[a-f0-9]{10})-.+\\.png$`))
  })

  it('allows clinic users to delete their media', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-delete` })
    const { basicUser, clinicStaff } = await createClinicUser('delete')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic delete',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-delete.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    await payload.delete({
      collection: 'clinicMedia',
      id: created.id,
      user: asClinicUser(basicUser),
      overrideAccess: false,
    })

    createdMediaIds.splice(createdMediaIds.indexOf(created.id), 1)

    await expect(
      payload.findByID({
        collection: 'clinicMedia',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('applies approved-clinic scoping for anonymous static-file reads', async () => {
    const { clinic: approvedClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-public`,
    })
    const { clinic: pendingClinic } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-private`,
    })

    await payload.update({
      collection: 'clinics',
      id: approvedClinic.id,
      data: { status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    await payload.update({
      collection: 'clinics',
      id: pendingClinic.id,
      data: { status: 'pending' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const approvedMedia = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Approved clinic media',
        clinic: approvedClinic.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-public-file.png`),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    const pendingMedia = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Pending clinic media',
        clinic: pendingClinic.id,
      } as Partial<ClinicMedia>,
      file: buildImageFile(`${slugPrefix}-private-file.png`),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(approvedMedia.id, pendingMedia.id)

    const staticReadFilter = await ClinicMediaCollection.access!.read!({
      req: { payload, user: null } as unknown as PayloadRequest,
      isReadingStaticFile: true,
    })

    expect(staticReadFilter).toEqual({
      'clinic.status': {
        equals: 'approved',
      },
    })

    if (!staticReadFilter || typeof staticReadFilter !== 'object') {
      throw new Error('Expected static read filter to be a where object')
    }
    const staticReadWhere = staticReadFilter as Where

    const approvedMatch = await payload.find({
      collection: 'clinicMedia',
      where: {
        and: [{ filename: { equals: approvedMedia.filename } }, staticReadWhere],
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    const pendingMatch = await payload.find({
      collection: 'clinicMedia',
      where: {
        and: [{ filename: { equals: pendingMedia.filename } }, staticReadWhere],
      },
      limit: 1,
      overrideAccess: true,
      depth: 0,
    })

    expect(approvedMatch.docs).toHaveLength(1)
    expect(pendingMatch.docs).toHaveLength(0)
  })
})
