import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { cleanupTestEntities } from '../fixtures/cleanupTestEntities'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, ClinicStaff, DoctorMedia } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

describe('DoctorMedia integration - lifecycle', () => {
  let payload: Payload
  let cityId: number
  const slugPrefix = testSlug('doctorMedia.lifecycle.test.ts')

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
    if (!cityDoc) throw new Error('Expected baseline city for doctor media tests')
    cityId = cityDoc.id as number
  }, 60000)

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'doctorMedia', id, overrideAccess: true })
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

  it('creates doctor media with clinic auto-set and storage path', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix })
    const { basicUser, clinicStaff } = await createClinicUser('create')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'doctorMedia',
      data: {
        alt: 'Doctor headshot',
        doctor: doctor.id,
      } as Partial<DoctorMedia>,
      file: buildImageFile(`${slugPrefix}-doctor.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as DoctorMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBe(basicUser.id)
    expect(created.clinic).toBe(clinic.id)
    expect(created.storagePath).toMatch(new RegExp(`^doctors/${doctor.id}/[a-f0-9]{10}/.+\\.png$`))
  })

  it('blocks clinic users from uploading media for doctors outside their clinic', async () => {
    const { clinic: clinicA, doctor: doctorA } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-a`,
    })
    const { clinic: clinicB, doctor: doctorB } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-b`,
      clinicIndex: 1,
      doctorIndex: 1,
    })

    const { basicUser, clinicStaff } = await createClinicUser('blocked')
    await approveClinicStaff(clinicStaff.id, clinicA.id as number)

    await expect(async () => {
      await payload.create({
        collection: 'doctorMedia',
        data: {
          alt: 'Blocked doctor',
          doctor: doctorB.id,
        } as Partial<DoctorMedia>,
        file: buildImageFile(`${slugPrefix}-blocked.png`),
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()

    expect(doctorA.id).not.toBe(doctorB.id)
    expect(clinicA.id).not.toBe(clinicB.id)
  })

  it('prevents changing the doctor relation on update', async () => {
    const { clinic: clinicA, doctor: doctorA } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-freeze-a`,
    })
    const { doctor: doctorB } = await createClinicFixture(payload, cityId, {
      slugPrefix: `${slugPrefix}-freeze-b`,
      clinicIndex: 2,
      doctorIndex: 2,
    })

    const { basicUser, clinicStaff } = await createClinicUser('freeze')
    await approveClinicStaff(clinicStaff.id, clinicA.id as number)

    const created = (await payload.create({
      collection: 'doctorMedia',
      data: {
        alt: 'Doctor media',
        doctor: doctorA.id,
      } as Partial<DoctorMedia>,
      file: buildImageFile(`${slugPrefix}-freeze.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as DoctorMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'doctorMedia',
        id: created.id,
        data: { doctor: doctorB.id },
        user: asClinicUser(basicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/doctor ownership/i)
  })

  it('allows updating caption without altering storagePath', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-update` })
    const { basicUser, clinicStaff } = await createClinicUser('update')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'doctorMedia',
      data: {
        alt: 'Before caption',
        doctor: doctor.id,
      } as Partial<DoctorMedia>,
      file: buildImageFile(`${slugPrefix}-update.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as DoctorMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'doctorMedia',
      id: created.id,
      data: {
        caption: {
          root: {
            type: 'root',
            children: [{ type: 'paragraph', version: 1, children: [{ type: 'text', text: 'Updated caption' }] }],
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
    } as PayloadUpdateArgs)) as DoctorMedia

    expect(updated.storagePath).toBe(created.storagePath)
  })

  it('allows clinic users to delete doctor media', async () => {
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${slugPrefix}-delete` })
    const { basicUser, clinicStaff } = await createClinicUser('delete')

    await approveClinicStaff(clinicStaff.id, clinic.id as number)

    const created = (await payload.create({
      collection: 'doctorMedia',
      data: {
        alt: 'Doctor delete',
        doctor: doctor.id,
      } as Partial<DoctorMedia>,
      file: buildImageFile(`${slugPrefix}-delete.png`),
      user: asClinicUser(basicUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as DoctorMedia

    createdMediaIds.push(created.id)

    await payload.delete({
      collection: 'doctorMedia',
      id: created.id,
      user: asClinicUser(basicUser),
      overrideAccess: false,
    })

    createdMediaIds.splice(createdMediaIds.indexOf(created.id), 1)

    await expect(
      payload.findByID({
        collection: 'doctorMedia',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
