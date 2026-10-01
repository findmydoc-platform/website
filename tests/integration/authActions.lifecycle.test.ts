import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createLocalReq,
  getPayload,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type Payload,
} from 'payload'
import config from '@payload-config'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { authActionDiagnosticFields, authActionRetentionMs } from '@/auth/actions/contracts'
import { commandOperationReference } from '@/features/transactionalEmail/commands'
import { createPatientTestUser, cleanupTrackedUsers } from '../fixtures/testUsers'
import { testSlug } from '../fixtures/testSlug'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

// A bounded barrier forces both real transactions to validate the same persisted predecessor.
function twoWriters() {
  let arrivals = 0
  let release!: () => void
  let timer: ReturnType<typeof setTimeout> | undefined
  const gate = new Promise<void>((resolve, reject) => {
    release = resolve
    timer = setTimeout(() => reject(new Error('AuthAction concurrency barrier timed out.')), 10000)
  })
  return {
    async arrive() {
      arrivals++
      if (arrivals === 2) {
        clearTimeout(timer)
        release()
      }
      if (arrivals <= 2) await gate
    },
    close() {
      clearTimeout(timer)
      release()
    },
  }
}

describe('AuthActions private Local API lifecycle contract', () => {
  let payload: Payload
  let now: number
  const actionIDs = new Set<number>()
  const patientIDs: Array<number | string> = []
  const prefix = testSlug('authActions.lifecycle.test.ts')
  const start = Date.parse('2026-10-01T10:00:00.000Z')
  const actions = async (at = now) =>
    bindAuthActions(await createLocalReq({}, payload), { environment: 'ci', now: () => at })
  const create = async () => {
    const action = await (await actions()).create({ actionType: 'patient-verification' })
    actionIDs.add(action.id)
    return action
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    now = start
  }, 60000)
  afterEach(async () => {
    vi.restoreAllMocks()
    const cleanup = await actions(start + 365 * 86400000)
    for (const id of actionIDs) {
      const action = await cleanup.read(id)
      if (action && !action.terminalAt) await cleanup.transition({ id, to: 'revoked' })
    }
    const purge = await actions(start + 730 * 86400000)
    await purge.sweep()
    for (const id of actionIDs) expect(await purge.read(id)).toBeNull()
    actionIDs.clear()
    await cleanupTrackedUsers(payload, { patientIds: patientIDs })
    now = start
  })

  it('persists native identity, binds a principal, completes and exposes only platform diagnostics', async () => {
    const action = await create()
    expect(commandOperationReference({ type: 'auth.email-verification', authActionId: action.id })).toBe(
      `v1|auth-action|${action.id}`,
    )
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${prefix}-principal`,
      createdPatientIds: patientIDs,
    })
    const system = await actions()
    await system.bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: patient.id } })
    for (const to of ['active', 'confirmed', 'completed'] as const) await system.transition({ id: action.id, to })
    const original = await system.read(action.id)
    const platform = { id: 100000001, collection: 'platformStaff' } as NonNullable<
      Parameters<typeof createLocalReq>[0]['user']
    >
    for (const overrideAccess of [false, true]) {
      const diagnostic = await payload.findByID({
        collection: 'authActions',
        id: action.id,
        user: platform,
        depth: 2,
        overrideAccess,
      })
      expect(Object.keys(diagnostic).sort()).toEqual([...authActionDiagnosticFields].sort())
      expect(diagnostic).toMatchObject({ state: 'completed', terminalAt: original!.terminalAt })
    }
    for (const collection of [undefined, 'patients', 'clinicStaff'] as const) {
      const user = collection ? ({ id: 100000001, collection } as typeof platform) : undefined
      await expect(
        payload.findByID({ collection: 'authActions', id: action.id, user, overrideAccess: true }),
      ).rejects.toMatchObject({ status: 403 })
    }
    await expect(
      payload.update({
        collection: 'authActions',
        id: action.id,
        data: { state: 'pending' },
        user: platform,
        context: { authActionCapability: {}, trustedSystem: true },
        overrideAccess: true,
      }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      payload.delete({ collection: 'authActions', id: action.id, user: platform, overrideAccess: true }),
    ).rejects.toMatchObject({ status: 403 })
    expect(await system.read(action.id)).toEqual(original)
  })

  it('expires at the deadline and deletes at day 42 without moving the original terminal time', async () => {
    const action = await create()
    now += 86400000
    expect(await (await actions()).sweep()).toEqual({ expired: 1, deleted: 0 })
    const terminal = await (await actions()).read(action.id)
    expect(terminal).toMatchObject({ state: 'expired', terminalAt: new Date(now).toISOString() })
    now += authActionRetentionMs - 1
    expect(await (await actions()).transition({ id: action.id, to: 'expired' })).toEqual(terminal)
    expect(await (await actions()).sweep()).toEqual({ expired: 0, deleted: 0 })
    now++
    expect(await (await actions()).sweep()).toEqual({ expired: 0, deleted: 1 })
    expect(await (await actions()).read(action.id)).toBeNull()
    expect(await (await actions()).sweep()).toEqual({ expired: 0, deleted: 0 })
  })

  it('keeps one-time binding and terminal cleanup after native principal deletion', async () => {
    const patient = await createPatientTestUser(payload, {
      emailPrefix: `${prefix}-deleted-principal`,
      createdPatientIds: patientIDs,
    })
    const replacement = await createPatientTestUser(payload, {
      emailPrefix: `${prefix}-replacement-principal`,
      createdPatientIds: patientIDs,
    })
    const system = await actions()
    const principal = { relationTo: 'patients' as const, value: patient.id }
    const verification = await system.create({ actionType: 'patient-verification', principal })
    const recovery = await system.create({ actionType: 'patient-recovery', principal })
    const cancelled = await system.create({ actionType: 'patient-recovery', principal })
    for (const action of [verification, recovery, cancelled]) actionIDs.add(action.id)
    await system.transition({ id: recovery.id, to: 'active' })
    const other = await create()
    await system.transition({ id: other.id, to: 'revoked' })

    await payload.delete({ collection: 'patients', id: patient.id, overrideAccess: true })
    for (const action of [verification, recovery, cancelled]) {
      expect(await system.read(action.id)).toMatchObject({ principal: null, principalBoundAt: action.principalBoundAt })
    }
    await expect(
      system.bindPrincipal({ id: verification.id, principal: { relationTo: 'patients', value: replacement.id } }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    await expect(system.transition({ id: recovery.id, to: 'confirmed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await system.transition({ id: cancelled.id, to: 'revoked', outcomeCode: 'source-unavailable' })

    now += authActionRetentionMs
    expect(await (await actions()).sweep()).toEqual({ expired: 2, deleted: 2 })
    expect(await (await actions()).read(recovery.id)).toMatchObject({ state: 'expired', principal: null })
    expect(await (await actions()).read(cancelled.id)).toBeNull()
  })

  it.each([false, true])(
    'serializes competing terminal commands and revalidates the loser (different=%s)',
    async (different) => {
      const action = await create()
      const barrier = twoWriters()
      const hooks = payload.collections.authActions.config.hooks.beforeChange
      const synchronize: CollectionBeforeChangeHook = async ({ data, originalDoc }) => {
        if (originalDoc?.id === action.id && originalDoc.state === 'pending') await barrier.arrive()
        return data
      }
      hooks.push(synchronize)
      const begin = vi.spyOn(payload.db, 'beginTransaction')
      try {
        const contenders = await Promise.all([actions(start + 1000), actions(start + 2000)])
        const results = await Promise.allSettled([
          contenders[0]!.transition({ id: action.id, to: 'superseded' }),
          contenders[1]!.transition({ id: action.id, to: different ? 'revoked' : 'superseded' }),
        ])
        const winners = results.filter((result) => result.status === 'fulfilled')
        const failures = results.filter((result) => result.status === 'rejected')
        expect(winners).toHaveLength(different ? 1 : 2)
        if (different) expect(failures[0]).toMatchObject({ reason: { code: 'invalid-transition' } })
        else expect(winners[0]).toEqual(winners[1])
        const persisted = await (await actions()).read(action.id)
        const winner = winners[0] as PromiseFulfilledResult<NonNullable<typeof persisted>>
        expect(persisted).toEqual(winner.value)
        expect([new Date(start + 1000).toISOString(), new Date(start + 2000).toISOString()]).toContain(
          persisted!.terminalAt,
        )
        expect(begin.mock.calls.length).toBeGreaterThanOrEqual(4) // Two contenders, a full retry and the final read.
        expect(begin.mock.calls.every(([options]) => options?.isolationLevel === 'serializable')).toBe(true)
      } finally {
        hooks.splice(hooks.indexOf(synchronize), 1)
        barrier.close()
      }
    },
  )

  it('serializes overlapping retention sweeps and counts only committed deletions', async () => {
    const action = await create()
    await (await actions()).transition({ id: action.id, to: 'revoked' })
    const barrier = twoWriters()
    const hooks = payload.collections.authActions.config.hooks.beforeDelete
    const synchronize: CollectionBeforeDeleteHook = async ({ id }) => {
      if (id === action.id) await barrier.arrive()
    }
    hooks.push(synchronize)
    try {
      const contenders = await Promise.all([
        actions(start + authActionRetentionMs),
        actions(start + authActionRetentionMs),
      ])
      const results = await Promise.all(contenders.map((system) => system.sweep()))
      expect(results.map(({ deleted }) => deleted).sort()).toEqual([0, 1])
      expect(await (await actions()).read(action.id)).toBeNull()
    } finally {
      hooks.splice(hooks.indexOf(synchronize), 1)
      barrier.close()
    }
  })
})
