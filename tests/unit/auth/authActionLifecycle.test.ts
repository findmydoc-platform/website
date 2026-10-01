import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { AuthActions } from '@/collections/AuthActions'
import { bindAuthActions } from '@/auth/actions/lifecycle'

vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async ({ context, req }: { context: object; req: object }, payload: Payload) => ({
    ...req,
    context,
    payload,
    user: null,
  }),
}))

const start = Date.parse('2026-10-01T10:00:00.000Z')
const day = 86400000

// The fake persists Local API documents and calls production hooks. It supplies no lifecycle decisions.
function storage() {
  const rows = new Map<number, Record<string, unknown>>()
  let nextID = 1
  const db = {
    beginTransaction: vi.fn(async () => 'owned'),
    commitTransaction: vi.fn(async () => undefined),
    rollbackTransaction: vi.fn(async () => undefined),
  }
  const operation = async (operation: string, options: Record<string, unknown>) => {
    for (const hook of AuthActions.hooks!.beforeOperation!)
      await hook({ operation, args: options, req: options.req } as Parameters<typeof hook>[0])
  }
  const read = async (doc: Record<string, unknown>, req: PayloadRequest) => {
    let result = structuredClone(doc)
    for (const hook of AuthActions.hooks!.afterRead!)
      result = await hook({ doc: result, req } as Parameters<typeof hook>[0])
    return result
  }
  const write = async (operation: 'create' | 'update', options: Record<string, unknown>) => {
    await operationGuard(operation, options)
    const originalDoc = operation === 'update' ? rows.get(options.id as number) : undefined
    let data = structuredClone(options.data) as Record<string, unknown>
    for (const hook of AuthActions.hooks!.beforeChange!)
      data = await hook({ data, originalDoc, operation, req: options.req } as Parameters<typeof hook>[0])
    const doc = { ...originalDoc, ...data, id: (options.id as number) ?? nextID++ }
    rows.set(doc.id, doc)
    return read(doc, options.req as PayloadRequest)
  }
  const operationGuard = operation
  const payload = {
    db,
    create: vi.fn((options) => write('create', options)),
    update: vi.fn((options) => write('update', options)),
    findByID: vi.fn(async (options) => {
      if (options.collection !== 'authActions') return { id: options.id }
      await operation('read', options)
      const doc = rows.get(options.id)
      return doc ? read(doc, options.req) : null
    }),
    find: vi.fn(async (options) => {
      await operation('read', options)
      // Sweep tests supply only due terminal records; production hooks still verify deletion eligibility.
      return { docs: await Promise.all([...rows.values()].map((doc) => read(doc, options.req))) }
    }),
    delete: vi.fn(async (options) => {
      await operation('delete', options)
      for (const hook of AuthActions.hooks!.beforeDelete!)
        await hook({ id: options.id, req: options.req } as Parameters<typeof hook>[0])
      const doc = rows.get(options.id)
      rows.delete(options.id)
      return doc
    }),
  } as unknown as Payload
  const req = { payload, context: {}, user: null } as PayloadRequest
  return { payload, req, rows, db }
}

describe('AuthAction lifecycle through the system command boundary', () => {
  let fixture: ReturnType<typeof storage>
  let now: number
  const actions = () => bindAuthActions(fixture.req, { environment: 'test', now: () => now })
  beforeEach(() => {
    fixture = storage()
    now = start
  })

  it('creates a pending action with its numeric identity and fixed verification policy', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    expect(action).toMatchObject({
      id: 1,
      state: 'pending',
      environment: 'test',
      supabaseTokenType: 'magiclink',
      callbackDestination: 'website-auth-callback',
      completionRoute: '/patient/inquiries',
      finalDestination: 'patient-inquiries',
      expiresAt: new Date(start + day).toISOString(),
    })
    expect(fixture.db.beginTransaction).toHaveBeenCalledWith({
      isolationLevel: 'serializable',
      accessMode: 'read write',
    })
    expect(fixture.req.transactionID).toBeUndefined()
  })

  it('binds a principal once, then completes the allowed path with no writes for repeated commands', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    await expect(actions().transition({ id: action.id, to: 'active' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } })
    for (const to of ['active', 'confirmed', 'completed'] as const) {
      const result = await actions().transition({ id: action.id, to })
      const writes = vi.mocked(fixture.payload.update).mock.calls.length
      now += 1000
      expect(await actions().transition({ id: action.id, to })).toEqual(result)
      expect(vi.mocked(fixture.payload.update).mock.calls.length).toBe(writes)
    }
    await expect(actions().transition({ id: action.id, to: 'revoked' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await expect(
      actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 10 } }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
  })

  it.each([
    ['clinic-invitation', 'clinicStaff', 'invite', 24 * 60, '/auth/invite/complete', 'clinic-dashboard'],
    ['patient-recovery', 'patients', 'recovery', 60, '/auth/password/reset/complete', 'patient-inquiries'],
    ['clinic-recovery', 'clinicStaff', 'recovery', 60, '/auth/password/reset/complete', 'clinic-dashboard'],
    ['platform-recovery', 'platformStaff', 'recovery', 60, '/auth/password/reset/complete', 'platform-administration'],
  ] as const)(
    'derives %s policy from its authoritative principal',
    async (actionType, relationTo, token, minutes, completionRoute, finalDestination) => {
      const action = await actions().create({ actionType, principal: { relationTo, value: 9 } })
      expect(action).toMatchObject({
        supabaseTokenType: token,
        completionRoute,
        finalDestination,
        expiresAt: new Date(start + minutes * 60000).toISOString(),
      })
      expect(fixture.payload.findByID).toHaveBeenCalledWith(
        expect.objectContaining({
          collection: relationTo,
          id: 9,
          req: expect.objectContaining({ transactionID: expect.any(Promise) }),
        }),
      )
    },
  )

  it('rejects skipped transitions, changed terminal outcomes and missing authoritative principals', async () => {
    vi.mocked(fixture.payload.findByID).mockResolvedValueOnce(null as never)
    await expect(
      actions().create({ actionType: 'patient-recovery', principal: { relationTo: 'patients', value: 9 } }),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    const action = await actions().create({ actionType: 'patient-verification' })
    await expect(actions().transition({ id: action.id, to: 'completed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await expect(actions().transition({ id: action.id, to: 'expired' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await expect(
      actions().transition({ id: action.id, to: 'completed', outcomeCode: 'ineligible' }),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    const terminal = await actions().transition({ id: action.id, to: 'revoked', outcomeCode: 'recipient-changed' })
    await expect(
      actions().transition({ id: action.id, to: 'revoked', outcomeCode: 'ineligible' }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    expect(await actions().read(action.id)).toEqual(terminal)
  })

  it('closes the capability after a successful command and rejects JSON flags', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    const internalReq = vi.mocked(fixture.payload.create).mock.calls[0]![0].req as PayloadRequest
    const guard = AuthActions.hooks!.beforeOperation![0]!
    for (const req of [
      internalReq,
      {
        ...fixture.req,
        transactionID: Promise.resolve('owned'),
        context: { authActionCapability: {}, trustedSystem: true },
      },
    ]) {
      await expect(
        guard({ operation: 'update', args: { id: action.id, data: { state: 'active' } }, req } as unknown as Parameters<
          typeof guard
        >[0]),
      ).rejects.toMatchObject({ status: 403 })
      await expect(guard({ operation: 'read', args: {}, req } as Parameters<typeof guard>[0])).rejects.toMatchObject({
        status: 403,
      })
    }
  })

  it('rejects credentials, caller-selected destinations and incompatible principals before storage', async () => {
    for (const extra of [
      { email: 'secret@example.test' },
      { tokenHash: 'secret' },
      { finalDestination: 'https://example.test' },
      { id: 44 },
    ])
      await expect(actions().create({ actionType: 'patient-verification', ...extra })).rejects.toMatchObject({
        code: 'invalid-command',
      })
    await expect(
      actions().create({ actionType: 'platform-recovery', principal: { relationTo: 'patients', value: 9 } }),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    expect(fixture.payload.create).not.toHaveBeenCalled()
  })

  it('never rebinds an action after its previously bound principal is hard-deleted', async () => {
    const action = await actions().create({
      actionType: 'patient-verification',
      principal: { relationTo: 'patients', value: 9 },
    })
    delete fixture.rows.get(action.id)!.principal // Native FK cascade removes the available relationship.
    await expect(
      actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 10 } }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
  })

  it('terminalizes a recovery whose principal disappeared without blocking another due deletion', async () => {
    const recovery = await actions().create({
      actionType: 'patient-recovery',
      principal: { relationTo: 'patients', value: 9 },
    })
    const other = await actions().create({ actionType: 'patient-verification' })
    await actions().transition({ id: other.id, to: 'revoked' })
    fixture.rows.get(recovery.id)!.principal = null
    await expect(actions().transition({ id: recovery.id, to: 'active' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    now += 42 * day
    expect(await actions().sweep()).toEqual({ expired: 1, deleted: 1 })
    expect(await actions().read(recovery.id)).toMatchObject({ state: 'expired', principal: null })
  })

  it('refuses progress after expiry and preserves the original terminal time through day 42', async () => {
    const action = await actions().create({
      actionType: 'patient-verification',
      principal: { relationTo: 'patients', value: 9 },
    })
    now = start + day
    await expect(actions().transition({ id: action.id, to: 'active' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    const terminal = await actions().transition({ id: action.id, to: 'expired' })
    now += 42 * day - 1
    expect(await actions().transition({ id: action.id, to: 'expired' })).toEqual(terminal)
    expect(await actions().sweep()).toEqual({ expired: 0, deleted: 0 })
    now++
    expect(await actions().sweep()).toEqual({ expired: 0, deleted: 1 })
    expect(await actions().sweep()).toEqual({ expired: 0, deleted: 0 })
  })

  it('rejects a borrowed transaction and does not expose cross-environment actions', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    await expect(bindAuthActions(fixture.req, { environment: 'preview' }).read(action.id)).rejects.toMatchObject({
      code: 'access-denied',
    })
    fixture.req.transactionID = 'unowned'
    await expect(actions().create({ actionType: 'patient-verification' })).rejects.toMatchObject({
      code: 'transaction-unavailable',
    })
  })

  it.each(['40001', '40P01'])('re-reads the full command after %s and bounds retries at three', async (code) => {
    const action = await actions().create({ actionType: 'patient-verification' })
    vi.mocked(fixture.payload.update).mockRejectedValue({ cause: { code } })
    await expect(actions().transition({ id: action.id, to: 'revoked' })).rejects.toMatchObject({ cause: { code } })
    expect(fixture.payload.update).toHaveBeenCalledTimes(3)
    expect(fixture.payload.findByID).toHaveBeenCalledTimes(3)
    expect(fixture.db.rollbackTransaction).toHaveBeenCalledTimes(3)
  })

  it('propagates commit and rollback failure and never retries an unrelated storage error', async () => {
    fixture.db.commitTransaction.mockRejectedValueOnce(new Error('commit failed'))
    await expect(actions().create({ actionType: 'patient-verification' })).rejects.toThrow('commit failed')
    fixture.db.rollbackTransaction.mockRejectedValueOnce(new Error('rollback failed'))
    vi.mocked(fixture.payload.create).mockRejectedValueOnce(new Error('write failed'))
    await expect(actions().create({ actionType: 'patient-verification' })).rejects.toBeInstanceOf(AggregateError)
    expect(fixture.db.beginTransaction).toHaveBeenCalledTimes(2)
  })
})
