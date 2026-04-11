import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import type { BasicUser, Patient } from '@/payload-types'

describe('Patient lifecycle integration', () => {
  let payload: Payload
  const slugPrefix = testSlug('patientLifecycle.test.ts')
  const createdBasicUserIds: Array<number> = []

  type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
  type PayloadCreateArgs = Parameters<Payload['create']>[0]
  type PayloadUpdateArgs = Parameters<Payload['update']>[0]

  const asPatientUser = (patient: Patient): PayloadUser => ({ ...patient, collection: 'patients' }) as PayloadUser
  const asPlatformUser = (basicUser: BasicUser): PayloadUser =>
    ({ ...basicUser, collection: 'basicUsers' }) as PayloadUser

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
  })

  beforeEach(async () => {
    try {
      await payload.delete({ collection: 'patients', where: {}, overrideAccess: true })
    } catch {}
  })

  afterEach(async () => {
    while (createdBasicUserIds.length) {
      const id = createdBasicUserIds.pop()
      if (!id) continue
      try {
        await payload.delete({
          collection: 'platformStaff',
          where: { user: { equals: id } },
          overrideAccess: true,
        })
      } catch {}
      try {
        await payload.delete({ collection: 'basicUsers', id, overrideAccess: true })
      } catch {}
    }
  })

  it('creates Patient -> creates Supabase user; then deletes both', async () => {
    const patient = await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.integration@example.com',
        firstName: 'Pat',
        lastName: 'Ent',
      },
      overrideAccess: true,
    })

    expect(patient.id).toBeDefined()
    expect(patient.supabaseUserId).toBe('sb-unit-1')

    await payload.delete({ collection: 'patients', id: patient.id, overrideAccess: true })
  }, 20000)

  it('rejects duplicate patient emails', async () => {
    await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.duplicate@example.com',
        firstName: 'Duplicate',
        lastName: 'Patient',
        supabaseUserId: 'sb-patient-dup-1',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)

    await expect(async () => {
      await payload.create({
        collection: 'patients',
        data: {
          email: 'patient.duplicate@example.com',
          firstName: 'Duplicate',
          lastName: 'Patient',
          supabaseUserId: 'sb-patient-dup-2',
        },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrowError(/email|unique|duplicate|constraint/i)
  }, 20000)

  it('rejects invalid country IDs', async () => {
    await expect(async () => {
      await payload.create({
        collection: 'patients',
        data: {
          email: 'patient.invalid-country@example.com',
          firstName: 'Invalid',
          lastName: 'Country',
          supabaseUserId: 'sb-patient-invalid-country',
          country: 999999999,
        },
        overrideAccess: true,
        depth: 0,
      } as PayloadCreateArgs)
    }).rejects.toThrow()
  }, 20000)

  it('defaults language to en when not provided', async () => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.language.default@example.com',
        firstName: 'Lang',
        lastName: 'Default',
        supabaseUserId: 'sb-patient-language-default',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    expect(patient.language).toBe('en')
  }, 20000)

  it('allows patients to update their own record and blocks updates to others', async () => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.self.update@example.com',
        firstName: 'Self',
        lastName: 'Update',
        supabaseUserId: 'sb-patient-self-update',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    const otherPatient = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.other.update@example.com',
        firstName: 'Other',
        lastName: 'Update',
        supabaseUserId: 'sb-patient-other-update',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    const updated = (await payload.update({
      collection: 'patients',
      id: patient.id,
      data: { lastName: 'Updated' },
      user: asPatientUser(patient),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as Patient

    expect(updated.lastName).toBe('Updated')

    await expect(async () => {
      await payload.update({
        collection: 'patients',
        id: otherPatient.id,
        data: { lastName: 'Blocked' },
        user: asPatientUser(patient),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs)
    }).rejects.toThrow()
  }, 20000)

  it('scopes reads to the own patient record and allows platform reads', async () => {
    const patientA = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.read.scope.a@example.com',
        firstName: 'Read',
        lastName: 'ScopeA',
        supabaseUserId: 'sb-patient-read-scope-a',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    const patientB = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.read.scope.b@example.com',
        firstName: 'Read',
        lastName: 'ScopeB',
        supabaseUserId: 'sb-patient-read-scope-b',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    const patientRead = await payload.find({
      collection: 'patients',
      user: asPatientUser(patientA),
      overrideAccess: false,
      depth: 0,
    })

    expect(patientRead.docs).toHaveLength(1)
    expect(patientRead.docs[0]?.id).toBe(patientA.id)
    expect(patientRead.docs[0]?.id).not.toBe(patientB.id)

    const platformUser = await createPlatformUser('read-scope')
    const platformRead = await payload.find({
      collection: 'patients',
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const ids = platformRead.docs.map((doc) => doc.id)
    expect(ids).toEqual(expect.arrayContaining([patientA.id, patientB.id]))
  }, 20000)

  it('blocks patient self-delete and allows platform delete', async () => {
    const patient = (await payload.create({
      collection: 'patients',
      data: {
        email: 'patient.delete.scope@example.com',
        firstName: 'Delete',
        lastName: 'Scope',
        supabaseUserId: 'sb-patient-delete-scope',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as Patient

    await expect(
      payload.delete({
        collection: 'patients',
        id: patient.id,
        user: asPatientUser(patient),
        overrideAccess: false,
      }),
    ).rejects.toThrow()

    const platformUser = await createPlatformUser('delete-scope')
    await payload.delete({
      collection: 'patients',
      id: patient.id,
      user: asPlatformUser(platformUser),
      overrideAccess: false,
    })
  }, 20000)
})
