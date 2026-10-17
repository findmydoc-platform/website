import type { PostgresAdapter } from '@payloadcms/db-postgres'
import {
  up as expandPersonalInvitation,
  down as removeUnusedPersonalInvitation,
} from '@/migrations/20261017_101649_personal_group_invitation'
import { recordClinicInitialPasswordCompletion } from '@/auth/utilities/clinicAccountCompletion'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { randomUUID } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import config from '@payload-config'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { createPlatformTestUser, asPayloadStaffUser } from '../fixtures/testUsers'
import { invitePersonalGroupManager } from '@/auth/actions/personalGroupInvitation'
import { createInitialClinicSupabaseAccount } from '@/auth/utilities/supabaseProvision'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { readClinicPrincipalAccess, readClinicTargetAccess } from '@/auth/utilities/clinicPrincipalAccess'

const provider = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn() }))
vi.mock('@/auth/utilities/supaBaseServer', () => ({ createClient: async () => ({ auth: provider }) }))

describe('trusted personal group manager invitation', () => {
  let payload: Payload
  let operator: PayloadRequest
  let groupId: number
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    operator = await createLocalReq(
      {
        user: asPayloadStaffUser(
          await createPlatformTestUser(payload, { emailPrefix: `personal-group-${randomUUID()}` }),
        ),
      },
      payload,
    )
    groupId = (
      await payload.create({
        collection: 'clinicGroups',
        data: { name: 'Personal invitation group' },
        req: operator,
        overrideAccess: false,
      })
    ).id
  })
  it('applies the additive schema before any personal invitation evidence exists', async () => {
    const args = {
      db: (payload.db as unknown as PostgresAdapter).drizzle,
      payload,
      req: await createLocalReq({}, payload),
    }
    await removeUnusedPersonalInvitation(args)
    await expandPersonalInvitation(args)
    expect(
      (await payload.findByID({ collection: 'clinicGroups', id: groupId, depth: 0, overrideAccess: true })).id,
    ).toBe(groupId)
  })

  it('prepares one approved synchronized personal principal and reserves its existing Auth invitation without a clinic application', async () => {
    const subject = randomUUID()
    vi.mocked(createInitialClinicSupabaseAccount).mockResolvedValueOnce(subject)
    const input = { groupId, email: `new-manager-${randomUUID()}@example.test`, firstName: 'New', lastName: 'Manager' }
    const result = await invitePersonalGroupManager(operator, input)
    const staff = await payload.findByID({
      collection: 'clinicStaff',
      id: result.staffId,
      depth: 0,
      overrideAccess: true,
    })
    expect(staff).toMatchObject({
      status: 'approved',
      assignmentScope: 'group',
      group: groupId,
      clinic: null,
      supabaseUserId: subject,
      authSync: { status: 'synced' },
    })
    expect(staff.onboardingKey).toMatch(/^personal-group-invitation:/)
    expect(staff.accountCompletion?.source).toBeFalsy()
    expect(staff.activationReadiness?.version).toBeFalsy()
    expect(await readClinicPrincipalAccess(payload, staff.id)).toBeNull()
    const auth = bindAuthActions(await createLocalReq({}, payload), { environment: 'ci' })
    const invitation = await auth.reserveClinicInvitation({ clinicStaffId: staff.id })
    expect(invitation).toMatchObject({ actionType: 'clinic-invitation', supabaseSubject: subject })
    const repeated = await invitePersonalGroupManager(operator, input)
    expect(repeated.staffId).toBe(staff.id)
    expect((await auth.reserveClinicInvitation({ clinicStaffId: staff.id }))?.id).toBe(invitation?.id)
  })
  it('records the exact personal proof, preserves it on replay, and derives current group clinics after activation', async () => {
    const subject = randomUUID()
    const email = `activate-manager-${randomUUID()}@example.test`
    vi.mocked(createInitialClinicSupabaseAccount).mockResolvedValueOnce(subject)
    const input = { groupId, email, firstName: 'Personal', lastName: 'Manager' }
    const { staffId } = await invitePersonalGroupManager(operator, input)
    const auth = bindAuthActions(await createLocalReq({}, payload), { environment: 'ci' })
    const action = (await auth.reserveClinicInvitation({ clinicStaffId: staffId }))!
    await expect(
      recordClinicInitialPasswordCompletion(
        await createLocalReq({}, payload),
        { authActionId: action.id, token: 'provider-mocked-proof' },
        'ci',
      ),
    ).rejects.toMatchObject({ status: 403 })
    for (const to of ['active', 'confirmed', 'completed'] as const) await auth.transition({ id: action.id, to })
    provider.getUser.mockResolvedValue({
      data: { user: { id: subject, email, app_metadata: { user_type: 'clinic' } } },
      error: null,
    })
    provider.getClaims.mockResolvedValue({
      data: { claims: { sub: subject, amr: [{ method: 'password', timestamp: Math.ceil(Date.now() / 1000) }] } },
      error: null,
    })
    provider.getClaims.mockResolvedValueOnce({
      data: { claims: { sub: subject, amr: [{ method: 'magiclink', timestamp: Math.ceil(Date.now() / 1000) }] } },
      error: null,
    })
    await expect(
      recordClinicInitialPasswordCompletion(
        await createLocalReq({}, payload),
        { authActionId: action.id, token: 'provider-mocked-proof' },
        'ci',
      ),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: staffId, depth: 0, overrideAccess: true }))
        .activationReadiness?.version,
    ).toBeFalsy()
    const activated = await recordClinicInitialPasswordCompletion(
      await createLocalReq({}, payload),
      { authActionId: action.id, token: 'provider-mocked-proof' },
      'ci',
    )
    expect(activated).toMatchObject({
      assignmentScope: 'group',
      group: groupId,
      clinic: null,
      accountCompletion: {
        source: 'group-initial-password',
        principalId: String(staffId),
        groupId: String(groupId),
        subject,
        authActionId: String(action.id),
      },
      activationReadiness: { version: 'identity-v1', principalId: String(staffId), subject },
    })
    expect(activated.accountCompletion?.clinicId).toBeFalsy()
    expect((await readClinicPrincipalAccess(payload, staffId))?.clinics).toEqual([])
    const replay = await recordClinicInitialPasswordCompletion(
      await createLocalReq({}, payload),
      { authActionId: action.id, token: 'provider-mocked-proof' },
      'ci',
    )
    expect(replay.accountCompletion).toEqual(activated.accountCompletion)
    expect(replay.activationReadiness).toEqual(activated.activationReadiness)
    expect(await invitePersonalGroupManager(operator, input)).toMatchObject({ staffId, invitation: 'completed' })
    const city = (await payload.find({ collection: 'cities', limit: 1, depth: 0, overrideAccess: true })).docs[0]!
    const { clinic } = await createClinicFixture(payload, city.id, { slugPrefix: `personal-group-${staffId}` })
    await payload.update({
      collection: 'clinics',
      id: clinic.id,
      data: { group: groupId, participationStatus: 'approved', status: 'pending' },
      req: operator,
      overrideAccess: false,
    })
    expect((await readClinicPrincipalAccess(payload, staffId))?.clinics.map(({ id }) => id)).toEqual([clinic.id])
    const foreign = await createClinicFixture(payload, city.id, { slugPrefix: `foreign-personal-${staffId}` })
    expect(await readClinicTargetAccess(payload, staffId, foreign.clinic.id)).toBeNull()
    await payload.update({
      collection: 'clinicStaff',
      id: staffId,
      data: { status: 'disabled' },
      req: operator,
      overrideAccess: false,
    })
    expect(await readClinicPrincipalAccess(payload, staffId)).toBeNull()
    expect(
      (await payload.findByID({ collection: 'clinicStaff', id: staffId, depth: 0, overrideAccess: true }))
        .accountCompletion,
    ).toEqual(activated.accountCompletion)
  })
  it('keeps an unknown provider outcome pending and reuses its reserved personal identity on retry', async () => {
    const input = {
      groupId,
      email: `unknown-manager-${randomUUID()}@example.test`,
      firstName: 'Unknown',
      lastName: 'Result',
    }
    vi.mocked(createInitialClinicSupabaseAccount).mockRejectedValueOnce(
      new Error('Synthetic unconfirmed provider result'),
    )
    await expect(invitePersonalGroupManager(operator, input)).rejects.toMatchObject({ status: 503 })
    const pending = (
      await payload.find({
        collection: 'clinicStaff',
        where: { email: { equals: input.email } },
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]!
    expect(pending.status).toBe('pending')
    expect(pending.activationReadiness?.version).toBeFalsy()
    expect(await readClinicPrincipalAccess(payload, pending.id)).toBeNull()
    const subject = randomUUID()
    vi.mocked(createInitialClinicSupabaseAccount).mockResolvedValueOnce(subject)
    const result = await invitePersonalGroupManager(operator, input)
    expect(result.staffId).toBe(pending.id)
    const stored = await payload.findByID({ collection: 'clinicStaff', id: pending.id, depth: 0, overrideAccess: true })
    expect(stored.onboardingKey).toBe(pending.onboardingKey)
    expect(stored.personalGroupInvitation).toEqual(pending.personalGroupInvitation)
    expect(stored.supabaseUserId).toBe(subject)
    expect(stored.accountCompletion?.source).toBeFalsy()
  })

  it('denies caller-made invitation origins and unauthorized operators without provider effects', async () => {
    const input = {
      groupId,
      email: `denied-manager-${randomUUID()}@example.test`,
      firstName: 'Denied',
      lastName: 'Manager',
    }
    const calls = vi.mocked(createInitialClinicSupabaseAccount).mock.calls.length
    await expect(invitePersonalGroupManager(await createLocalReq({}, payload), input)).rejects.toMatchObject({
      status: 403,
    })
    await expect(
      payload.create({
        collection: 'clinicStaff',
        overrideAccess: true,
        context: { trustedPlatformStaffOps: true, personalGroupInvitationCapability: {}, seed: true },
        data: {
          email: input.email,
          status: 'pending',
          assignmentScope: 'group',
          group: groupId,
          clinic: null,
          onboardingKey: `personal-group-invitation:${randomUUID()}`,
          personalGroupInvitation: {
            groupId: String(groupId),
            operatorId: String(operator.user!.id),
            authorizedAt: new Date().toISOString(),
          },
        },
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(vi.mocked(createInitialClinicSupabaseAccount).mock.calls.length).toBe(calls)
  })
  it.each(['activation-first', 'revocation-first'] as const)(
    'keeps personal evidence and current denial consistent for %s',
    async (order) => {
      const subject = randomUUID()
      const input = {
        groupId,
        email: `ordered-${randomUUID()}@example.test`,
        firstName: 'Ordered',
        lastName: 'Manager',
      }
      vi.mocked(createInitialClinicSupabaseAccount).mockResolvedValueOnce(subject)
      const { staffId } = await invitePersonalGroupManager(operator, input)
      const auth = bindAuthActions(await createLocalReq({}, payload), { environment: 'ci' })
      const action = (await auth.reserveClinicInvitation({ clinicStaffId: staffId }))!
      for (const to of ['active', 'confirmed', 'completed'] as const) await auth.transition({ id: action.id, to })
      provider.getUser.mockResolvedValue({
        data: { user: { id: subject, email: input.email, app_metadata: { user_type: 'clinic' } } },
        error: null,
      })
      const claims = {
        data: { claims: { sub: subject, amr: [{ method: 'password', timestamp: Math.ceil(Date.now() / 1000) }] } },
        error: null,
      }
      provider.getClaims.mockResolvedValue(claims)
      const revoke = () =>
        payload.update({
          collection: 'clinicStaff',
          id: staffId,
          data: { status: 'disabled' },
          req: operator,
          overrideAccess: false,
        })
      if (order === 'revocation-first') {
        let started!: () => void
        let release!: () => void
        const observed = new Promise<void>((resolve) => {
          started = resolve
        })
        const held = new Promise<void>((resolve) => {
          release = resolve
        })
        provider.getClaims.mockImplementationOnce(async () => {
          started()
          await held
          return claims
        })
        const completion = recordClinicInitialPasswordCompletion(
          await createLocalReq({}, payload),
          { authActionId: action.id, token: 'provider-mocked-proof' },
          'ci',
        )
        await observed
        try {
          await revoke()
        } finally {
          release()
        }
        await expect(completion).rejects.toMatchObject({ status: 403 })
      } else {
        await recordClinicInitialPasswordCompletion(
          await createLocalReq({}, payload),
          { authActionId: action.id, token: 'provider-mocked-proof' },
          'ci',
        )
        await revoke()
      }
      const current = await payload.findByID({ collection: 'clinicStaff', id: staffId, depth: 0, overrideAccess: true })
      expect(current).toMatchObject({ id: staffId, supabaseUserId: subject, status: 'disabled', group: groupId })
      expect(Boolean(current.activationReadiness?.version)).toBe(order === 'activation-first')
      expect(Boolean(current.accountCompletion?.source)).toBe(order === 'activation-first')
      expect(await readClinicPrincipalAccess(payload, staffId)).toBeNull()
      await expect(invitePersonalGroupManager(operator, input)).rejects.toMatchObject({ status: 409 })
    },
  )
})
