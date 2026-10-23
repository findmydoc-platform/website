import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type CollectionBeforeChangeHook, type Payload } from 'payload'
import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { createPlatformTestUser } from '../fixtures/testUsers'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { renewExpiredClinicInvitation } from '@/auth/actions/clinicInvitationRequests'
import { bindProtocolPasswordCompletion } from '@/auth/actions/protocol/passwordCompletion'
import type { User } from '@supabase/supabase-js'
import { runOwnedTransaction } from '@/features/transactionalEmail/transactions'
import { openStorageCapability } from '@/features/transactionalEmail/capability'
import { openClinicInvitationOperator } from '../../scripts/renew-clinic-invitation'

const provider = vi.hoisted(() => ({ users: new Map<string, User>() }))
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: async () => ({
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: provider.users.get(id) ?? null }, error: null }),
      },
    },
  }),
}))

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
    await cleanupTransactionalEmailFixtures(
      payload,
      [...created.actions].map((id) => `v1|auth-action|${id}`),
    )
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    provider.users.clear()
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

  it('renews through the authorized operator seam and accepts exactly one managed invitation', async () => {
    const staff = await initialStaff()
    const system = await actions()
    const first = (await system.reserveClinicInvitation({ clinicStaffId: staff.id }))!
    created.actions.add(first.id)
    await system.transition({ id: first.id, to: 'active' })
    await system.transition({ id: first.id, to: 'confirmed' })
    const original = await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true })
    now += 2 * 86400000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.stubEnv('CI', 'true')
    provider.users.set(staff.supabaseUserId!, {
      id: staff.supabaseUserId!,
      email: staff.email,
      email_confirmed_at: first.createdAt,
      app_metadata: { user_type: 'clinic', onboarding_key: staff.onboardingKey },
      user_metadata: {},
      aud: 'authenticated',
      created_at: first.createdAt,
    } as User)
    const operator = await createPlatformTestUser(payload, { emailPrefix: `${prefix}-renewal-${randomUUID()}` })
    const req = await createLocalReq({ user: { ...operator, collection: 'platformStaff' } }, payload)
    const command = { clinicStaffId: staff.id, expiredActionId: first.id, dryRun: true }
    try {
      await expect(renewExpiredClinicInvitation(await createLocalReq({}, payload), command)).rejects.toMatchObject({
        status: 403,
      })
      expect(await renewExpiredClinicInvitation(req, command)).toMatchObject({
        status: 'eligible',
        authActionId: first.id,
      })
      expect((await system.read(first.id))!.state).toBe('confirmed')
      const concurrent = await Promise.allSettled(
        [1, 2].map(() => renewExpiredClinicInvitation(req, { ...command, dryRun: false })),
      )
      const accepted = concurrent.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []))
      expect(accepted.length).toBeGreaterThan(0)
      expect(new Set(accepted.map((result) => result.authActionId)).size).toBe(1)
      const result = accepted[0]!
      created.actions.add(result.authActionId)
      expect(result.status).toBe('accepted')
      expect(await renewExpiredClinicInvitation(req, { ...command, dryRun: false })).toMatchObject({
        authActionId: result.authActionId,
      })
      expect(await (await actions()).read(first.id)).toMatchObject({ state: 'expired' })
      expect(await (await actions()).read(result.authActionId)).toMatchObject({
        state: 'active',
        actionType: 'clinic-invitation',
        supabaseTokenType: 'recovery',
        supabaseSubject: staff.supabaseUserId,
      })
      const outbox = await runOwnedTransaction(await createLocalReq({}, payload), async (_, transactionID) => {
        const capability = openStorageCapability(transactionID)
        try {
          const scoped = await createLocalReq(
            { context: capability.context, req: { transactionID: Promise.resolve(transactionID) } },
            payload,
          )
          return await payload.find({
            collection: 'transactionalEmailOutbox',
            req: scoped,
            overrideAccess: true,
            depth: 0,
            where: { operationReference: { equals: `v1|auth-action|${result.authActionId}` } },
          })
        } finally {
          capability.close()
        }
      })
      expect(outbox.totalDocs).toBe(1)
      expect(outbox.docs[0]!.commandType).toBe('auth.invitation')
      expect(
        await payload.findByID({ collection: 'clinicStaff', id: staff.id, depth: 0, overrideAccess: true }),
      ).toEqual(original)
    } finally {
      await payload.delete({ collection: 'platformStaff', id: operator.id, overrideAccess: true })
    }
  })

  it('starts the real operator CLI without managed-content or dry-run KV writes and retains protocol guards', async () => {
    const staff = await initialStaff()
    const first = (await (await actions()).reserveClinicInvitation({ clinicStaffId: staff.id }))!
    created.actions.add(first.id)
    now += 2 * 86400000
    vi.spyOn(Date, 'now').mockImplementation(() => now)
    vi.stubEnv('CI', 'false')
    vi.stubEnv('DEPLOYMENT_ENVIRONMENT', 'ci')
    const operator = await createPlatformTestUser(payload, { emailPrefix: `${prefix}-startup-${randomUUID()}` })
    const resolved = await config
    const originalStartup = resolved.onInit
    const ordinaryStartup = vi.fn(originalStartup)
    resolved.onInit = ordinaryStartup
    const writes: string[] = []
    const watched = ['pages', 'redirects', 'payload-kv'].map((slug) =>
      resolved.collections.find((collection) => collection.slug === slug)!,
    )
    const kvConfig = watched[2]!
    const originalKvChange = kvConfig.hooks.beforeChange
    const originalKvDelete = kvConfig.hooks.beforeDelete
    kvConfig.hooks.beforeChange = []
    kvConfig.hooks.beforeDelete = []
    const guard = ({ operation, collection }: { operation: string; collection: { slug: string } }) => {
      if (['create', 'update', 'delete'].includes(operation)) {
        writes.push(collection.slug)
        if (collection.slug !== 'payload-kv')
          throw new Error('Managed content must not change during operator startup.')
      }
    }
    for (const collection of watched) collection.hooks.beforeOperation.push(guard as never)
    let session: Awaited<ReturnType<typeof openClinicInvitationOperator>> | undefined
    try {
      session = await openClinicInvitationOperator(operator.id)
      const dryRun = await renewExpiredClinicInvitation(session.req, {
        clinicStaffId: staff.id,
        expiredActionId: first.id,
        dryRun: true,
      })
      expect(dryRun.status).toBe('eligible')
      expect(ordinaryStartup.mock.calls.length).toBe(0)
      expect(process.env.CI).toBe('false')
      expect(writes).toEqual([])
      await expect(
        session.req.payload.create({
          collection: 'payload-kv',
          overrideAccess: true,
          data: { key: 'auth-action-password:v1:test:subject:forged', data: { actionId: first.id } },
        }),
      ).rejects.toMatchObject({ status: 403 })
      expect(
        (
          await session.req.payload.find({
            collection: 'payload-kv',
            overrideAccess: true,
            where: { key: { equals: 'auth-action-password:v1:test:subject:forged' } },
          })
        ).totalDocs,
      ).toBe(0)
    } finally {
      resolved.onInit = originalStartup
      kvConfig.hooks.beforeChange = originalKvChange
      kvConfig.hooks.beforeDelete = originalKvDelete
      for (const collection of watched)
        collection.hooks.beforeOperation.splice(collection.hooks.beforeOperation.indexOf(guard as never), 1)
      await session?.close()
      await payload.delete({ collection: 'platformStaff', id: operator.id, overrideAccess: true })
    }
  })

  it('retains a real uncertain password claim and refuses operator renewal after expiry', async () => {
    const staff = await initialStaff()
    const system = await actions()
    const first = (await system.reserveClinicInvitation({ clinicStaffId: staff.id }))!
    created.actions.add(first.id)
    await system.transition({ id: first.id, to: 'active' })
    const confirmed = await system.transition({ id: first.id, to: 'confirmed' })
    const req = await createLocalReq({}, payload)
    const passwords = bindProtocolPasswordCompletion(req, 'ci')
    expect(
      await passwords.execute({
        action: confirmed,
        subject: staff.supabaseUserId!,
        requestId: randomUUID(),
        verifyCurrentAuthority: async () => undefined,
        updatePassword: async () => ({ data: { user: null }, error: { status: 503 } }),
      }),
    ).toBe('unavailable')
    now += 2 * 86400000
    await expect(
      (await actions()).renewClinicInvitation({ clinicStaffId: staff.id, expiredActionId: first.id, dryRun: false }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    expect(await passwords.invitationRenewalBlocked(confirmed)).toBe(true)
  })
})
