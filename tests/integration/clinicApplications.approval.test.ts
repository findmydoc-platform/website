import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { runBaselineContract } from './contracts/baselineContract'
import type { Clinic, ClinicApplication, ClinicStaff, PlatformStaff } from '@/payload-types'
import { inviteClinicSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { provisionClinicOnboarding } from '@/features/clinicOnboarding/provisionClinicOnboarding'

type PayloadUser = NonNullable<Parameters<Payload['create']>[0]['user']>
type PayloadCreateArgs = Parameters<Payload['create']>[0]
type PayloadUpdateArgs = Parameters<Payload['update']>[0]
type PayloadFindArgs = Parameters<Payload['find']>[0]

describe('ClinicApplications approval integration', () => {
  let payload: Payload
  let medicalSpecialtyIds: number[] = []
  const slugPrefix = testSlug('clinicApplications.approval.test.ts')
  const createdApplicationIds: Array<number> = []
  const createdClinicIds: Array<number> = []
  const createdClinicStaffIds: Array<number> = []
  const createdPlatformStaffIds: Array<number> = []
  const createdOnboardingKeys: Array<string> = []

  const asClinicUser = (user: ClinicStaff): PayloadUser =>
    ({ ...user, collection: 'clinicStaff' }) as unknown as PayloadUser
  const asPlatformUser = (user: PlatformStaff): PayloadUser =>
    ({ ...user, collection: 'platformStaff' }) as unknown as PayloadUser

  const extractRelationId = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : null
    }

    if (value && typeof value === 'object' && 'id' in value) {
      return extractRelationId((value as { id?: unknown }).id)
    }

    return null
  }

  const buildApplicationData = (email: string) => ({
    clinicName: 'Integration App Clinic',
    contactFirstName: 'Ivy',
    contactLastName: 'Tester',
    contactEmail: email,
    contactRole: 'Clinic Management',
    clinicWebsite: 'https://integration-clinic.example',
    medicalSpecialties: medicalSpecialtyIds,
  })

  const createPlatformUser = async (suffix: string) => {
    const email = `${slugPrefix}-platform-${suffix}@findmydoc.eu`
    const platformStaff = (await payload.create({
      collection: 'platformStaff',
      data: {
        email,
        firstName: 'Platform',
        lastName: `User-${suffix}`,
        role: 'support',
        supabaseUserId: `sb-${slugPrefix}-platform-${suffix}`,
      },
      context: { trustedPlatformStaffOps: true },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as PlatformStaff

    createdPlatformStaffIds.push(platformStaff.id)
    return platformStaff
  }

  const createClinicUser = async (suffix: string) => {
    const email = `${slugPrefix}-clinic-${suffix}@example.com`
    const clinicStaff = (await payload.create({
      collection: 'clinicStaff',
      data: {
        email,
        firstName: 'Clinic',
        lastName: `User-${suffix}`,
        status: 'pending',
        supabaseUserId: `sb-${slugPrefix}-clinic-${suffix}`,
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicStaff

    createdClinicStaffIds.push(clinicStaff.id)
    return clinicStaff
  }

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)

    const specialtiesResult = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      limit: 1000,
      overrideAccess: false,
      pagination: false,
      select: {
        id: true,
        name: true,
        parentSpecialty: true,
      },
    })

    medicalSpecialtyIds = specialtiesResult.docs
      .filter((specialty) => extractRelationId((specialty as { parentSpecialty?: unknown }).parentSpecialty) === null)
      .slice(0, 2)
      .map((specialty) => specialty.id)

    if (medicalSpecialtyIds.length === 0) {
      throw new Error('Expected at least one top-level medical specialty for clinic application tests.')
    }
  }, 60000)

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(inviteClinicSupabaseAccount).mockImplementation(async ({ onboardingKey }) => `sb-clinic-${onboardingKey}`)
  })

  afterEach(async () => {
    const onboardingKeys = [
      ...createdOnboardingKeys.splice(0),
      ...createdApplicationIds.map((id) => `clinic-application:${id}`),
    ]

    for (const onboardingKey of onboardingKeys) {
      const [staffResult, clinicResult] = await Promise.all([
        payload.find({
          collection: 'clinicStaff',
          depth: 0,
          limit: 10,
          overrideAccess: true,
          pagination: false,
          where: { onboardingKey: { equals: onboardingKey } },
        }),
        payload.find({
          collection: 'clinics',
          depth: 0,
          limit: 10,
          overrideAccess: true,
          pagination: false,
          trash: true,
          where: { onboardingKey: { equals: onboardingKey } },
        }),
      ])

      for (const staff of staffResult.docs) {
        if (!createdClinicStaffIds.includes(staff.id)) createdClinicStaffIds.push(staff.id)
      }
      for (const clinic of clinicResult.docs) {
        if (!createdClinicIds.includes(clinic.id)) createdClinicIds.push(clinic.id)
      }
    }

    while (createdApplicationIds.length) {
      const id = createdApplicationIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
      } catch {}
    }

    while (createdClinicStaffIds.length) {
      const id = createdClinicStaffIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true })
      } catch {}
    }

    while (createdClinicIds.length) {
      const id = createdClinicIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'clinics', id, overrideAccess: true })
      } catch {}
    }

    while (createdPlatformStaffIds.length) {
      const id = createdPlatformStaffIds.pop()
      if (!id) continue
      try {
        await payload.delete({ collection: 'platformStaff', id, overrideAccess: true })
      } catch {}
    }
  }, 30000)

  it('materializes a pending clinic and initial staff principal after approval', async () => {
    const email = `${slugPrefix}-approval@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: {
        ...buildApplicationData(email),
        status: 'submitted',
      },
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    expect(app.id).toBeDefined()
    expect(app.status).toBe('submitted')

    await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const appAfter = (await payload.findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicApplication

    expect(appAfter.status).toBe('approved')
    expect(appAfter.provisioningStatus).toBe('completed')
    expect(appAfter.provisioningErrorCode ?? null).toBeNull()

    const clinicId = extractRelationId(appAfter.linkedRecords?.clinic)
    const clinicStaffId = extractRelationId(appAfter.linkedRecords?.clinicStaff)
    expect(clinicId).not.toBeNull()
    expect(clinicStaffId).not.toBeNull()
    expect(appAfter.linkedRecords?.processedAt).toBeTruthy()
    expect('basicUsers' in (appAfter.linkedRecords ?? {})).toBe(false)

    const [clinic, clinicStaff] = await Promise.all([
      payload.findByID({ collection: 'clinics', id: clinicId!, overrideAccess: true, depth: 0 }),
      payload.findByID({ collection: 'clinicStaff', id: clinicStaffId!, overrideAccess: true, depth: 0 }),
    ])
    expect((clinic as Clinic).status).toBe('pending')
    expect((clinic as Clinic).internalPrimaryContact?.email).toBe(email)
    expect(clinicStaff as ClinicStaff).toMatchObject({
      email,
      status: 'pending',
      authSync: { status: 'synced' },
    })

    await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { reviewNotes: 'No duplicate provisioning.' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const [clinics, staff] = await Promise.all([
      payload.find({
        collection: 'clinics',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: `clinic-application:${app.id}` } },
      }),
      payload.find({
        collection: 'clinicStaff',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: `clinic-application:${app.id}` } },
      }),
    ])
    expect(clinics.docs).toHaveLength(1)
    expect(staff.docs).toHaveLength(1)
    expect(inviteClinicSupabaseAccount).toHaveBeenCalledOnce()
  }, 45000)

  it('keeps retry-created records traceable after an invite failure', async () => {
    const email = `${slugPrefix}-resume@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication
    createdApplicationIds.push(app.id)
    vi.mocked(inviteClinicSupabaseAccount).mockRejectedValueOnce(new Error('temporary auth failure'))

    await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { status: 'approved' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const failed = (await payload.findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicApplication
    expect(failed.provisioningStatus).toBe('failed')
    expect(failed.provisioningErrorCode).toBe('auth_failed')

    await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { reviewNotes: 'This must not retry provisioning.' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const stillFailed = (await payload.findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicApplication
    expect(stillFailed.provisioningStatus).toBe('failed')
    expect(inviteClinicSupabaseAccount).toHaveBeenCalledOnce()

    await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { contactLastName: 'Retried Tester' },
      overrideAccess: true,
      depth: 0,
    } as PayloadUpdateArgs)

    const completed = (await payload.findByID({
      collection: 'clinicApplications',
      id: app.id,
      overrideAccess: true,
      depth: 0,
    })) as ClinicApplication
    expect(completed.provisioningStatus).toBe('completed')
    expect(completed.provisioningErrorCode ?? null).toBeNull()

    const [clinics, staff] = await Promise.all([
      payload.find({
        collection: 'clinics',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: `clinic-application:${app.id}` } },
      }),
      payload.find({
        collection: 'clinicStaff',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: `clinic-application:${app.id}` } },
      }),
    ])
    expect(clinics.docs).toHaveLength(2)
    expect(staff.docs).toHaveLength(2)
    expect(inviteClinicSupabaseAccount).toHaveBeenCalledTimes(2)
  }, 45000)

  it('allows repeated generic onboarding commands to leave traceable duplicate records', async () => {
    const onboardingKey = `${slugPrefix}:duplicate`
    createdOnboardingKeys.push(onboardingKey)
    const command = {
      onboardingKey,
      clinicName: 'Duplicate Clinic',
      website: 'https://duplicate-clinic.example',
      contactFirstName: 'Grace',
      contactLastName: 'Hopper',
      contactEmail: `${slugPrefix}-duplicate@example.com`,
      contactRole: 'Clinic Management' as const,
    }

    await provisionClinicOnboarding(payload, command)
    await expect(provisionClinicOnboarding(payload, command)).rejects.toMatchObject({ code: 'binding_failed' })

    const [clinics, staff] = await Promise.all([
      payload.find({
        collection: 'clinics',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: onboardingKey } },
      }),
      payload.find({
        collection: 'clinicStaff',
        depth: 0,
        limit: 10,
        overrideAccess: true,
        pagination: false,
        where: { onboardingKey: { equals: onboardingKey } },
      }),
    ])

    expect(clinics.docs).toHaveLength(2)
    expect(staff.docs).toHaveLength(2)
    expect(inviteClinicSupabaseAccount).toHaveBeenCalledTimes(2)
  }, 45000)

  it('blocks public collection create outside the controlled API route', async () => {
    const email = `${slugPrefix}-public@example.com`

    await expect(
      payload.create({
        collection: 'clinicApplications',
        data: buildApplicationData(email),
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow(/not allowed|perform this action/i)
  })

  it('allows platform users to set reviewNotes', async () => {
    const email = `${slugPrefix}-review@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    const platformUser = await createPlatformUser('review-notes')
    const updated = (await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: { reviewNotes: 'Reviewed by platform.' },
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicApplication

    expect(updated.reviewNotes).toBe('Reviewed by platform.')
  })

  it('blocks non-platform users from read/list/update access', async () => {
    const email = `${slugPrefix}-blocked@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    const clinicUser = await createClinicUser('blocked')

    await expect(
      payload.find({
        collection: 'clinicApplications',
        user: asClinicUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadFindArgs),
    ).rejects.toThrow(/not allowed|perform this action/i)

    await expect(
      payload.update({
        collection: 'clinicApplications',
        id: app.id,
        data: { status: 'approved', reviewNotes: 'Should not persist.' },
        user: asClinicUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      } as PayloadUpdateArgs),
    ).rejects.toThrow()
  })

  it('rejects missing required fields', async () => {
    await expect(
      payload.create({
        collection: 'clinicApplications',
        data: {},
        overrideAccess: false,
        depth: 0,
      } as PayloadCreateArgs),
    ).rejects.toThrow()
  })

  it('keeps linked records system-owned', async () => {
    const email = `${slugPrefix}-linked@example.com`
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(email),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    expect(app.linkedRecords?.processedAt ?? null).toBeNull()

    const platformUser = await createPlatformUser('linked-records')
    const processedAt = '2020-01-01T00:00:00.000Z'
    const updated = (await payload.update({
      collection: 'clinicApplications',
      id: app.id,
      data: {
        linkedRecords: { processedAt },
      },
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    } as PayloadUpdateArgs)) as ClinicApplication

    expect(updated.status).toBe('submitted')
    expect(updated.linkedRecords?.processedAt ?? null).toBeNull()
  })

  it('matches the baseline collection contract', async () => {
    const email = `${slugPrefix}-baseline@example.com`

    await runBaselineContract<ClinicApplication>({
      collection: 'clinicApplications',
      createPrivileged: async () => {
        const created = (await payload.create({
          collection: 'clinicApplications',
          data: buildApplicationData(email),
          overrideAccess: true,
          depth: 0,
        } as PayloadCreateArgs)) as ClinicApplication

        createdApplicationIds.push(created.id)
        return created
      },
      getId: (doc) => doc.id,
      readPrivileged: async (id) =>
        (await payload.findByID({
          collection: 'clinicApplications',
          id,
          overrideAccess: true,
          depth: 0,
        })) as ClinicApplication,
      updatePrivileged: async (id) =>
        (await payload.update({
          collection: 'clinicApplications',
          id,
          data: { status: 'approved' },
          overrideAccess: true,
          depth: 0,
        } as PayloadUpdateArgs)) as ClinicApplication,
      assertUpdated: (doc) => {
        expect(doc.status).toBe('approved')
      },
      assertDeniedWrite: async (id) => {
        const clinicUser = await createClinicUser('baseline-denied')

        await expect(
          payload.update({
            collection: 'clinicApplications',
            id,
            data: { status: 'rejected' },
            user: asClinicUser(clinicUser),
            overrideAccess: false,
            depth: 0,
          } as PayloadUpdateArgs),
        ).rejects.toThrow(/not allowed|perform this action/i)
      },
      deletePrivileged: async (id) => {
        const platformUser = await createPlatformUser('baseline-delete')

        const deleted = await payload.delete({
          collection: 'clinicApplications',
          id,
          user: asPlatformUser(platformUser),
          overrideAccess: false,
          depth: 0,
        })

        const index = createdApplicationIds.indexOf(Number(id))
        if (index >= 0) createdApplicationIds.splice(index, 1)
        return deleted
      },
    })
  })

  it('allows platform delete and blocks clinic delete', async () => {
    const app = (await payload.create({
      collection: 'clinicApplications',
      data: buildApplicationData(`${slugPrefix}-delete-access@example.com`),
      overrideAccess: true,
      depth: 0,
    } as PayloadCreateArgs)) as ClinicApplication

    createdApplicationIds.push(app.id)

    const clinicUser = await createClinicUser('delete-denied')

    await expect(
      payload.delete({
        collection: 'clinicApplications',
        id: app.id,
        user: asClinicUser(clinicUser),
        overrideAccess: false,
        depth: 0,
      }),
    ).rejects.toThrow(/not allowed|perform this action/i)

    const platformUser = await createPlatformUser('delete-allowed')

    await payload.delete({
      collection: 'clinicApplications',
      id: app.id,
      user: asPlatformUser(platformUser),
      overrideAccess: false,
      depth: 0,
    })

    const index = createdApplicationIds.indexOf(app.id)
    if (index >= 0) createdApplicationIds.splice(index, 1)

    await expect(
      payload.findByID({
        collection: 'clinicApplications',
        id: app.id,
        overrideAccess: true,
        depth: 0,
      }),
    ).rejects.toThrow()
  })
})
