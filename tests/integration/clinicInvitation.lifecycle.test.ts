import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type CollectionBeforeChangeHook, type Payload } from 'payload'
import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

describe('committed clinic invitation reservation', () => {
  let payload: Payload
  let cityId: number
  let specialtyId: number
  let now = Date.parse('2026-10-03T10:00:00.000Z')
  const prefix = testSlug('clinicInvitation.lifecycle.test.ts')
  const created = {
    actions: new Set<number>(),
    applications: [] as number[],
    staff: [] as number[],
    clinics: [] as number[],
    doctors: [] as number[],
  }
  const actions = async () => bindAuthActions(await createLocalReq({}, payload), { environment: 'ci', now: () => now })

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    cityId = (await payload.find({ collection: 'cities', overrideAccess: true, limit: 1 })).docs[0]!.id
    specialtyId = (
      await payload.find({
        collection: 'medical-specialties',
        overrideAccess: true,
        limit: 1,
        where: { parentSpecialty: { exists: false } },
      })
    ).docs[0]!.id
  }, 60000)

  async function initialStaff() {
    const email = `${prefix}-${randomUUID()}@example.test`
    const application = await payload.create({
      collection: 'clinicApplications',
      overrideAccess: true,
      data: {
        status: 'submitted',
        clinicName: 'Invitation contract clinic',
        clinicWebsite: 'https://clinic.example.test',
        contactLastName: 'Contact',
        contactEmail: email,
        contactRole: 'Clinic Management',
        medicalSpecialties: [specialtyId],
      },
    })
    created.applications.push(application.id)
    const onboardingKey = `clinic-application:${application.id}`
    const { clinic, doctor } = await createClinicFixture(payload, cityId, { slugPrefix: `${prefix}-${application.id}` })
    created.clinics.push(clinic.id)
    created.doctors.push(doctor.id)
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      overrideAccess: true,
      data: { status: 'pending', participationStatus: 'approved', onboardingKey },
    })
    const staff = await payload.create({
      collection: 'clinicStaff',
      overrideAccess: true,
      context: { skipClinicStaffAuthSync: true },
      data: {
        email,
        lastName: 'Contact',
        clinic: clinic.id,
        status: 'approved',
        onboardingKey,
        supabaseUserId: randomUUID(),
        authSync: { status: 'synced' },
      },
    })
    created.staff.push(staff.id)
    await payload.update({
      collection: 'clinicApplications',
      id: application.id,
      overrideAccess: true,
      context: { skipClinicApplicationProvisioning: true },
      data: {
        status: 'approved',
        provisioningStatus: 'completed',
        linkedRecords: { clinic: clinic.id, clinicStaff: staff.id },
      },
    })
    return staff
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    now += 365 * 86400000
    const cleanup = await actions()
    for (const id of created.actions) {
      const action = await cleanup.read(id)
      if (action && !action.terminalAt) await cleanup.transition({ id, to: 'revoked' })
    }
    now += 43 * 86400000
    await (await actions()).sweep()
    created.actions.clear()
    for (const id of created.applications.splice(0))
      await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
    for (const id of created.staff.splice(0))
      await payload.delete({ collection: 'clinicStaff', id, overrideAccess: true })
    for (const id of created.doctors.splice(0))
      await payload.delete({ collection: 'doctors', id, overrideAccess: true })
    for (const id of created.clinics.splice(0))
      await payload.delete({ collection: 'clinics', id, overrideAccess: true })
  })

  it('persists native principal queries, immutable subject and durable private authorization', async () => {
    const staff = await initialStaff()
    const system = await actions()
    const first = (await system.reserveClinicInvitation({ clinicStaffId: staff.id }))!
    created.actions.add(first.id)
    expect(first.supabaseSubject).toBe(staff.supabaseUserId)
    expect((await system.reserveClinicInvitation({ clinicStaffId: staff.id }))!.id).toBe(first.id)
    const stored = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true, depth: 0 })
    expect(stored.invitationAuthorizedAt).toBe(new Date(now).toISOString())
    expect(stored.invitationAttemptedAt).toBeFalsy()
    await expect(
      payload.update({
        collection: 'clinicStaff',
        id: staff.id,
        overrideAccess: true,
        data: { invitationAuthorizedAt: null },
      }),
    ).rejects.toMatchObject({ status: 403 })
    await system.transition({ id: first.id, to: 'active' })
    now += 900000
    const next = (await (await actions()).reserveClinicInvitation({ clinicStaffId: staff.id, resendOf: first.id }))!
    created.actions.add(next.id)
    expect(await (await actions()).read(first.id)).toMatchObject({ state: 'superseded' })
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true }))
        .invitationAuthorizedAt,
    ).toBe(stored.invitationAuthorizedAt)
  })

  it('deduplicates concurrent initial reservations through the real Serializable transaction', async () => {
    const staff = await initialStaff()
    let arrivals = 0
    let release!: () => void
    let timer: ReturnType<typeof setTimeout>
    const gate = new Promise<void>((resolve, reject) => {
      release = resolve
      timer = setTimeout(() => reject(new Error('Invitation concurrency barrier timed out.')), 10000)
    })
    const hooks = payload.collections.authActions.config.hooks.beforeChange
    const synchronize: CollectionBeforeChangeHook = async ({ operation, data }) => {
      if (operation !== 'create' || data.supabaseSubject !== staff.supabaseUserId) return
      arrivals++
      if (arrivals === 2) {
        clearTimeout(timer)
        release()
      }
      if (arrivals <= 2) await gate
    }
    hooks.push(synchronize)
    try {
      const results = await Promise.all(
        [1, 2].map(async () => {
          const result = (await (await actions()).reserveClinicInvitation({ clinicStaffId: staff.id }))!
          created.actions.add(result.id)
          return result
        }),
      )
      expect(results[0]!.id).toBe(results[1]!.id)
      expect(results[0]!.subjectBoundAt).toBe(results[1]!.subjectBoundAt)
    } finally {
      hooks.splice(hooks.indexOf(synchronize), 1)
      clearTimeout(timer!)
      release()
    }
  })

  it('rolls back the action when its durable authorization marker cannot commit', async () => {
    const staff = await initialStaff()
    let attemptedId: number | undefined
    const create = payload.create.bind(payload)
    vi.spyOn(payload, 'create').mockImplementation(async (input) => {
      const result = await create(input)
      if (input.collection === 'authActions') attemptedId = result.id
      return result
    })
    const hooks = payload.collections.clinicStaff.config.hooks.beforeChange
    const failMarker: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
      if (originalDoc?.id === staff.id && data.invitationAuthorizedAt) throw new Error('Synthetic marker failure.')
    }
    hooks.push(failMarker)
    try {
      await expect((await actions()).reserveClinicInvitation({ clinicStaffId: staff.id })).rejects.toThrow()
      expect(attemptedId).toBeTypeOf('number')
      expect(await (await actions()).read(attemptedId!)).toBeNull()
      const unchanged = await payload.findByID({ collection: 'clinicStaff', id: staff.id, overrideAccess: true })
      expect(unchanged.invitationAuthorizedAt).toBeFalsy()
      expect(unchanged.status).toBe('approved')
      expect(unchanged.supabaseUserId).toBe(staff.supabaseUserId)
    } finally {
      hooks.splice(hooks.indexOf(failMarker), 1)
    }
  })
})
