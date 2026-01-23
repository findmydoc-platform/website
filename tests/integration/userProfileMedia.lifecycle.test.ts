import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload, File } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient, UserProfileMedia } from '@/payload-types'

vi.mock('@payloadcms/storage-s3', () => ({
  s3Storage: () => (incomingConfig: unknown) => incomingConfig,
}))

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]

type UserRelation = UserProfileMedia['user']

describe('UserProfileMedia integration - lifecycle', () => {
  let payload: Payload
  const slugPrefix = testSlug('userProfileMedia.lifecycle.test.ts')

  const createdMediaIds: Array<number> = []
  const createdPatientIds: Array<number> = []
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

  const asPatientUser = (patient: Patient): PayloadUser => ({ ...patient, collection: 'patients' }) as PayloadUser
  const asPlatformUser = (user: BasicUser): PayloadUser => ({ ...user, collection: 'basicUsers' }) as PayloadUser

  const createPatient = async (suffix: string) => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: `${slugPrefix}-${suffix}@example.com`,
        supabaseUserId: `sb-${slugPrefix}-${suffix}`,
        firstName: 'Patient',
        lastName: suffix,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    createdPatientIds.push(patient.id)
    return patient
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

  const getRelationValueId = (relation: UserRelation) => {
    if (typeof relation.value === 'number') return relation.value
    return relation.value.id
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
  }, 60000)

  afterEach(async () => {
    while (createdMediaIds.length) {
      const id = createdMediaIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'userProfileMedia', id, overrideAccess: true })
    }

    while (createdPatientIds.length) {
      const id = createdPatientIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'patients', id, overrideAccess: true })
    }

    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
    }
  })

  it('creates profile media for the owning patient with createdBy and storage path', async () => {
    const patient = await createPatient('create')

    const created = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        // Owner is auto-derived from the authenticated requester when omitted.
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-profile.png`),
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia

    createdMediaIds.push(created.id)

    expect(created.createdBy).toBeDefined()
    expect(created.createdBy?.relationTo).toBe('patients')
    expect(getRelationValueId(created.createdBy!)).toBe(patient.id)
    expect(created.user.relationTo).toBe('patients')
    expect(getRelationValueId(created.user)).toBe(patient.id)
    expect(created.storagePath).toMatch(new RegExp(`^users/${patient.id}/[a-f0-9]{10}/.+\\.png$`))
  })

  it('blocks patients from uploading media for another user', async () => {
    const patient = await createPatient('owner')
    const otherPatient = await createPatient('other')

    await expect(async () => {
      await payload.create({
        collection: 'userProfileMedia',
        data: {
          user: { relationTo: 'patients', value: otherPatient.id },
        } as Partial<UserProfileMedia>,
        file: buildImageFile(`${slugPrefix}-blocked.png`),
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  })

  it('prevents changing the owner user on update', async () => {
    const patient = await createPatient('freeze')
    const otherPatient = await createPatient('freeze-other')

    const created = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        user: { relationTo: 'patients', value: patient.id },
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-freeze.png`),
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia

    createdMediaIds.push(created.id)

    await expect(async () => {
      await payload.update({
        collection: 'userProfileMedia',
        id: created.id,
        data: { user: { relationTo: 'patients', value: otherPatient.id } },
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow(/user ownership/i)
  })

  it('allows replacing the image file without altering createdBy', async () => {
    const patient = await createPatient('update')

    const created = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        user: { relationTo: 'patients', value: patient.id },
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-update.png`),
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia

    createdMediaIds.push(created.id)

    const updated = (await payload.update({
      collection: 'userProfileMedia',
      id: created.id,
      data: {},
      file: buildImageFile(`${slugPrefix}-update-replace.png`),
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as UserProfileMedia

    expect(updated.createdBy).toBeDefined()
    expect(updated.createdBy?.relationTo).toBe('patients')
    expect(getRelationValueId(updated.createdBy!)).toBe(patient.id)
  })

  it('scopes reads to the owner and allows platform users to read all', async () => {
    const patientA = await createPatient('reader-a')
    const patientB = await createPatient('reader-b')

    const mediaA = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        user: { relationTo: 'patients', value: patientA.id },
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-reader-a.png`),
      user: asPatientUser(patientA),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia
    createdMediaIds.push(mediaA.id)

    const mediaB = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        user: { relationTo: 'patients', value: patientB.id },
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-reader-b.png`),
      user: asPatientUser(patientB),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia
    createdMediaIds.push(mediaB.id)

    const patientRead = await payload.find({
      collection: 'userProfileMedia',
      user: asPatientUser(patientA),
      overrideAccess: false,
      depth: 0,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.id).toBe(mediaA.id)

    const platformUser = await createPlatformUser('reader')
    const platformRead = await payload.find({
      collection: 'userProfileMedia',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const platformIds = platformRead.docs.map((doc) => doc.id)
    expect(platformIds).toEqual(expect.arrayContaining([mediaA.id, mediaB.id]))
  })

  it('allows patients to delete their media', async () => {
    const patient = await createPatient('delete')

    const created = (await payload.create({
      collection: 'userProfileMedia',
      data: {
        user: { relationTo: 'patients', value: patient.id },
      } as Partial<UserProfileMedia>,
      file: buildImageFile(`${slugPrefix}-delete.png`),
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadCreateArgs)) as UserProfileMedia

    createdMediaIds.push(created.id)

    await payload.delete({
      collection: 'userProfileMedia',
      id: created.id,
      user: asPatientUser(patient),
      overrideAccess: false,
    })

    createdMediaIds.splice(createdMediaIds.indexOf(created.id), 1)

    await expect(
      payload.findByID({
        collection: 'userProfileMedia',
        id: created.id,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
