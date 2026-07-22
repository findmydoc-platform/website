import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, PayloadRequest, Where } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import { cleanupTrackedDocs } from '../fixtures/cleanupTrackedDocs'
import { createTinyPngFile } from '../fixtures/mediaFile'
import { approveClinicStaff, asStaffPayloadUser, createClinicStaffFixture } from '../fixtures/clinicUserFixtures'
import type { ClinicMedia } from '@/payload-types'
import { ClinicMedia as ClinicMediaCollection } from '@/collections/ClinicMedia'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('ClinicMedia integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('clinicMedia.lifecycle.test.ts')

  const createdMediaIds: Array<number> = []
  const createdClinicStaffIds: Array<number> = []
  const createdStaffIds: Array<number> = []

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const cityRes = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true, depth: 0 })
    const cityDoc = cityRes.docs[0]
    if (!cityDoc) throw new Error('Expected baseline city for clinic media tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    await cleanupTrackedDocs(payload, [
      { collection: 'clinicMedia', ids: createdMediaIds },
      { collection: 'clinicStaff', ids: createdClinicStaffIds },
      { collection: 'platformStaff', ids: createdStaffIds },
    ])

    await cleanupTestEntities(payload, 'doctors', slugPrefix)
    await cleanupTestEntities(payload, 'clinics', slugPrefix)
  })

  it('creates clinic media for own clinic with createdBy and storage path', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'create',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic hero',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-clinic.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toEqual({ relationTo: 'clinicStaff', value: staffUser.id })
    expect(created.storagePath).toMatch(new RegExp(`^clinics/${clinic.id}-[a-f0-9]{10}-.+\\.png$`))
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
      collection: 'clinicMedia',
      data: {
        alt: 'Auto assign media',
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-auto-assign.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)
    expect(created.clinic).toBe(clinic.id)
  })

  it('blocks clinic users from uploading for another clinic', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-b` })

    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'blocked',
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, clinicA.id as number)

    await expect(async () => {
      await payload.create({
        collection: 'clinicMedia',
        data: {
          alt: 'Wrong clinic',
          clinic: clinicB.id,
        } as Partial<ClinicMedia>,
        file: createTinyPngFile(`${slugPrefix}-blocked.png`),
        user: asStaffPayloadUser(staffUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('prevents changing clinic ownership on update', async () => {
    const { clinic: clinicA } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-a` })
    const { clinic: clinicB } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-freeze-b` })

    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'freeze',
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, clinicA.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic media',
        clinic: clinicA.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-freeze.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'clinicMedia',
        id: created.id,
        data: { clinic: clinicB.id },
        user: asStaffPayloadUser(staffUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/clinic ownership|assign records to another clinic/i)
  })

  it('updates metadata without altering createdBy or storagePath', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'update',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Before alt',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-update.png`),
      user: asStaffPayloadUser(staffUser),
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
      user: asStaffPayloadUser(staffUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicMedia

    expect(updated.createdBy).toEqual({ relationTo: 'clinicStaff', value: staffUser.id })
    expect(updated.storagePath).toMatch(new RegExp(`^clinics/${clinic.id}-(\\d+|[a-f0-9]{10})-.+\\.png$`))
  })

  it('allows clinic users to delete their media', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-delete` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'delete',
      createdClinicStaffIds,
    })

    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Clinic delete',
        clinic: clinic.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-delete.png`),
      user: asStaffPayloadUser(staffUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    createdMediaIds.push(created.id)

    await payload.delete({
      collection: 'clinicMedia',
      id: created.id,
      user: asStaffPayloadUser(staffUser),
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

  it('returns the expected read filters for clinic, patient, and unassigned static-file requests', async () => {
    const { clinic } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-access-filters` })
    const { staffUser, clinicStaff } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'access-filters',
      createdClinicStaffIds,
    })
    await approveClinicStaff(payload, clinicStaff.id, clinic.id as number)

    const documentReadFilter = await ClinicMediaCollection.access!.read!({
      req: {
        payload,
        user: asStaffPayloadUser(staffUser),
      } as unknown as PayloadRequest,
    })

    expect(documentReadFilter).toEqual({
      clinic: {
        equals: clinic.id,
      },
    })

    const staticClinicFilter = await ClinicMediaCollection.access!.read!({
      req: {
        payload,
        user: asStaffPayloadUser(staffUser),
      } as unknown as PayloadRequest,
      isReadingStaticFile: true,
    })

    expect(staticClinicFilter).toEqual({
      clinic: {
        equals: clinic.id,
      },
    })

    const staticPatientFilter = await ClinicMediaCollection.access!.read!({
      req: {
        payload,
        user: { id: 999, collection: 'patients' },
      } as unknown as PayloadRequest,
      isReadingStaticFile: true,
    })

    expect(staticPatientFilter).toEqual({
      'clinic.status': {
        equals: 'approved',
      },
    })

    const { staffUser: unassignedClinicUser } = await createClinicStaffFixture(payload, {
      slugPrefix,
      suffix: 'access-unassigned',
      createdClinicStaffIds,
    })

    const deniedStaticRead = await ClinicMediaCollection.access!.read!({
      req: {
        payload,
        user: asStaffPayloadUser(unassignedClinicUser),
      } as unknown as PayloadRequest,
      isReadingStaticFile: true,
    })

    expect(deniedStaticRead).toBe(false)
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
      file: createTinyPngFile(`${slugPrefix}-public-file.png`),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicMedia

    const pendingMedia = (await payload.create({
      collection: 'clinicMedia',
      data: {
        alt: 'Pending clinic media',
        clinic: pendingClinic.id,
      } as Partial<ClinicMedia>,
      file: createTinyPngFile(`${slugPrefix}-private-file.png`),
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
