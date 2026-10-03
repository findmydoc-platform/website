import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import { AuthActions } from '@/collections/AuthActions'
import { bindAuthActions, guardClinicInvitationAuthorization } from '@/auth/actions/lifecycle'
import { bindPendingPatientVerification } from '@/auth/actions/pendingPatientVerification'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

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

function matchesWhere(doc: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([field, value]) => {
    if (field === 'and' || field === 'or') {
      const clauses = value as Record<string, unknown>[]
      return field === 'and'
        ? clauses.every((item) => matchesWhere(doc, item))
        : clauses.some((item) => matchesWhere(doc, item))
    }
    return Object.entries(value as Record<string, unknown>).every(([operator, expected]) => {
      const actual = field
        .split('.')
        .reduce<unknown>(
          (value, key) => (value && typeof value === 'object' ? Reflect.get(value, key) : undefined),
          doc,
        )
      switch (operator) {
        case 'equals':
          return actual === expected
        case 'in':
          return (expected as unknown[]).includes(actual)
        case 'not_in':
          return !(expected as unknown[]).includes(actual)
        case 'exists':
          return expected ? actual != null : actual == null
        case 'greater_than':
          return actual != null && String(actual) > String(expected)
        case 'less_than_equal':
          return actual != null && String(actual) <= String(expected)
        default:
          throw new Error(`Unsupported storage predicate: ${operator}`)
      }
    })
  })
}

// The fake persists Local API documents and calls production hooks. It supplies no lifecycle decisions.
function storage() {
  const rows = new Map<number, Record<string, unknown>>()
  const principals = new Map<number, Record<string, unknown>>()
  const sources = new Map<string, Record<string, unknown>>()
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
    update: vi.fn(async (options) => {
      if (options.collection === 'clinicStaff') {
        const key = `clinicStaff:${options.id}`
        await guardClinicInvitationAuthorization({
          data: options.data,
          originalDoc: sources.get(key),
          operation: 'update',
          req: options.req,
        } as never)
        const doc = { ...sources.get(key), ...options.data }
        sources.set(key, doc)
        return Promise.resolve(doc)
      }
      return write('update', options)
    }),
    findByID: vi.fn(async (options) => {
      if (options.collection !== 'authActions')
        return sources.get(`${options.collection}:${options.id}`) ?? principals.get(options.id) ?? { id: options.id }
      await operation('read', options)
      const doc = rows.get(options.id)
      return doc ? read(doc, options.req) : null
    }),
    find: vi.fn(async (options) => {
      await operation('read', options)
      const docs = [...rows.values()].filter((doc) => matchesWhere(doc, options.where ?? {}))
      docs.sort((left, right) =>
        options.sort === '-createdAt'
          ? String(right.createdAt).localeCompare(String(left.createdAt))
          : Number(left.id) - Number(right.id),
      )
      return {
        docs: await Promise.all(docs.slice(0, options.limit ?? docs.length).map((doc) => read(doc, options.req))),
      }
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
  return { payload, req, rows, db, principals, sources }
}

describe('AuthAction lifecycle through the system command boundary', () => {
  let fixture: ReturnType<typeof storage>
  let now: number
  const actions = () => bindAuthActions(fixture.req, { environment: 'test', now: () => now })
  beforeEach(() => {
    fixture = storage()
    now = start
  })

  const clinicSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
  function approvedClinic() {
    fixture.sources.set('clinicStaff:61', {
      id: 61,
      email: 'staff@example.test',
      status: 'approved',
      clinic: 71,
      onboardingKey: 'clinic-application:81',
      supabaseUserId: clinicSubject,
      authSync: { status: 'synced' },
    })
    fixture.sources.set('clinics:71', {
      id: 71,
      status: 'pending',
      participationStatus: 'approved',
      onboardingKey: 'clinic-application:81',
    })
    fixture.sources.set('clinicApplications:81', {
      id: 81,
      status: 'approved',
      provisioningStatus: 'completed',
      contactEmail: 'staff@example.test',
      linkedRecords: { clinic: 71, clinicStaff: 61 },
    })
  }

  it('reserves the approved initial staff invitation with immutable identity and Dashboard destinations', async () => {
    approvedClinic()
    const action = await actions().reserveClinicInvitation({ clinicStaffId: 61 })
    expect(action).toMatchObject({
      actionType: 'clinic-invitation',
      state: 'pending',
      environment: 'test',
      principal: { relationTo: 'clinicStaff', value: 61 },
      supabaseSubject: clinicSubject,
      subjectBoundAt: new Date(start).toISOString(),
      expiresAt: new Date(start + day).toISOString(),
      callbackDestination: 'clinic-dashboard-auth-callback',
      completionRoute: '/auth/invite/complete',
    })
    now += 1000
    expect(await actions().reserveClinicInvitation({ clinicStaffId: 61 })).toEqual(action)
    expect(fixture.rows.size).toBe(1)
    expect(JSON.stringify(action)).not.toContain('staff@example.test')
    expect(fixture.payload.update).toHaveBeenCalledOnce()
    expect(fixture.sources.get('clinicStaff:61')?.invitationAuthorizedAt).toBe(new Date(start).toISOString())
  })

  it.each([
    ['clinicStaff:61', { status: 'pending' }],
    ['clinicStaff:61', { authSync: { status: 'pending' } }],
    ['clinicStaff:61', { supabaseUserId: null }],
    ['clinicStaff:61', { accountCompletion: { source: 'initial-password' } }],
    ['clinicStaff:61', { legacyAccess: { eligibleAt: new Date(start).toISOString() } }],
    ['clinicStaff:61', { invitationAttemptedAt: new Date(start).toISOString() }],
    ['clinicStaff:61', { clinic: 72 }],
    ['clinicStaff:61', { onboardingKey: 'manual-staff' }],
    ['clinics:71', { participationStatus: 'pending' }],
    ['clinics:71', { status: 'rejected' }],
    ['clinics:71', { deletedAt: new Date(start).toISOString() }],
    ['clinicApplications:81', { status: 'submitted' }],
    ['clinicApplications:81', { contactEmail: 'other@example.test' }],
    ['clinicApplications:81', { linkedRecords: { clinic: 71, clinicStaff: 62 } }],
  ] as const)('denies ineligible clinic invitation without changing approval: %s %j', async (key, changed) => {
    approvedClinic()
    fixture.sources.set(key, { ...fixture.sources.get(key), ...changed })
    const before = structuredClone([...fixture.sources])
    expect(await actions().reserveClinicInvitation({ clinicStaffId: 61 })).toBeNull()
    expect(fixture.rows.size).toBe(0)
    expect([...fixture.sources]).toEqual(before)
  })

  it('limits authorized invitation replacement, preserves confirmed actions and isolates environments', async () => {
    approvedClinic()
    const first = (await actions().reserveClinicInvitation({ clinicStaffId: 61 }))!
    now += 899999
    await expect(actions().reserveClinicInvitation({ clinicStaffId: 61, resendOf: first.id })).rejects.toMatchObject({
      code: 'rate-limited',
    })
    now++
    const second = (await actions().reserveClinicInvitation({ clinicStaffId: 61, resendOf: first.id }))!
    expect(await actions().read(first.id)).toMatchObject({ state: 'superseded' })
    now += 900000
    const third = (await actions().reserveClinicInvitation({ clinicStaffId: 61, resendOf: second.id }))!
    now += 900000
    await expect(actions().reserveClinicInvitation({ clinicStaffId: 61, resendOf: third.id })).rejects.toMatchObject({
      code: 'rate-limited',
    })
    expect(
      (await bindAuthActions(fixture.req, { environment: 'local', now: () => now }).reserveClinicInvitation({
        clinicStaffId: 61,
      }))!.environment,
    ).toBe('local')
    await actions().transition({ id: third.id, to: 'active' })
    await actions().transition({ id: third.id, to: 'confirmed' })
    await expect(actions().reserveClinicInvitation({ clinicStaffId: 61, resendOf: third.id })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
  })

  it('checks the current clinic identity and approval before progressing an invitation', async () => {
    approvedClinic()
    const action = (await actions().reserveClinicInvitation({ clinicStaffId: 61 }))!
    fixture.sources.get('clinicStaff:61')!.supabaseUserId = '9edb6591-3115-4f1e-a09e-315951ca3628'
    await expect(actions().transition({ id: action.id, to: 'active' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    fixture.sources.get('clinicStaff:61')!.supabaseUserId = clinicSubject
    await actions().transition({ id: action.id, to: 'active' })
    fixture.sources.get('clinics:71')!.participationStatus = 'pending'
    await expect(actions().transition({ id: action.id, to: 'confirmed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    expect(await actions().read(action.id)).toMatchObject({ state: 'active', supabaseSubject: clinicSubject })
  })

  it('expires the predecessor at exactly 24 hours without moving its initial invitation marker', async () => {
    approvedClinic()
    const first = (await actions().reserveClinicInvitation({ clinicStaffId: 61 }))!
    now += day
    const next = (await actions().reserveClinicInvitation({ clinicStaffId: 61 }))!
    expect(next.id).not.toBe(first.id)
    expect(await actions().read(first.id)).toMatchObject({ state: 'expired', terminalAt: new Date(now).toISOString() })
    expect(fixture.sources.get('clinicStaff:61')?.invitationAuthorizedAt).toBe(new Date(start).toISOString())
    expect(fixture.payload.update).toHaveBeenCalledTimes(2)
  })

  it('rejects unbound clinic actions and caller-supplied recipients or redirects', async () => {
    approvedClinic()
    const unbound = await actions().create({
      actionType: 'clinic-invitation',
      principal: { relationTo: 'clinicStaff', value: 61 },
    })
    await expect(actions().transition({ id: unbound.id, to: 'active' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    await expect(
      actions().reserveClinicInvitation({ clinicStaffId: 61, email: 'other@example.test' } as never),
    ).rejects.toMatchObject({ code: 'invalid-command' })
    await expect(
      actions().reserveClinicInvitation({ clinicStaffId: 61, callbackDestination: 'https://other.example' } as never),
    ).rejects.toMatchObject({ code: 'invalid-command' })
  })

  it('rejects forged or copied authorization markers, while preserving ordinary empty groups and retries', async () => {
    const req = fixture.req
    for (const operation of ['create', 'update'] as const) {
      await expect(
        guardClinicInvitationAuthorization({
          operation,
          req,
          data: { invitationAuthorizedAt: new Date(start).toISOString() },
          originalDoc: { id: 61 },
        } as never),
      ).rejects.toMatchObject({ code: 'access-denied' })
    }
    expect(
      await guardClinicInvitationAuthorization({
        operation: 'create',
        req,
        data: { invitationAuthorizedAt: null },
      } as never),
    ).toEqual({ invitationAuthorizedAt: null })
    const marker = new Date(start).toISOString()
    expect(
      await guardClinicInvitationAuthorization({
        operation: 'update',
        req,
        originalDoc: { id: 61, invitationAuthorizedAt: marker },
        data: { firstName: 'Updated', invitationAuthorizedAt: marker },
      } as never),
    ).toMatchObject({ invitationAuthorizedAt: marker })
    await expect(
      guardClinicInvitationAuthorization({
        operation: 'update',
        req,
        originalDoc: { id: 61, invitationAuthorizedAt: marker },
        data: { invitationAuthorizedAt: null },
      } as never),
    ).rejects.toMatchObject({ code: 'access-denied' })
  })

  it('rechecks the committed approval after a serialization conflict and propagates marker failure', async () => {
    approvedClinic()
    vi.mocked(fixture.payload.find).mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: '40001' }))
    expect(await actions().reserveClinicInvitation({ clinicStaffId: 61 })).toMatchObject({ state: 'pending' })
    expect(fixture.db.rollbackTransaction).toHaveBeenCalledOnce()
    expect(fixture.db.beginTransaction).toHaveBeenCalledTimes(2)
    expect(fixture.payload.findByID).toHaveBeenCalledTimes(7)

    fixture = storage()
    approvedClinic()
    const before = structuredClone([...fixture.sources])
    vi.mocked(fixture.payload.update).mockRejectedValueOnce(new Error('marker unavailable'))
    await expect(actions().reserveClinicInvitation({ clinicStaffId: 61 })).rejects.toThrow('marker unavailable')
    expect(fixture.db.commitTransaction).not.toHaveBeenCalled()
    expect(fixture.db.rollbackTransaction).toHaveBeenCalledOnce()
    expect([...fixture.sources]).toEqual(before)
  })

  it('resumes one private pending verification for normalized email before any subject exists', async () => {
    const system = bindAuthActions(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
    })
    const first = await system.reservePatientVerification({ email: ' Patient+tag@Example.test ' })
    const repeated = await system.reservePatientVerification({ email: 'patient+tag@example.test' })
    expect(repeated.id).toBe(first.id)
    expect(first).toMatchObject({ state: 'pending', correlationKeyVersion: 'test-v1', supabaseSubject: null })
    expect(first.correlationDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(first)).not.toContain('patient+tag@example.test')
  })

  it('separates environments and addresses, and resumes a previous-key action after rotation', async () => {
    const old = { version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }
    const current = { version: 'test-v2', secret: 'synthetic-rotated-material-only-for-tests-v2' }
    const bind = (environment: 'test' | 'local', verificationKeys: (typeof old)[]) =>
      bindAuthActions(fixture.req, {
        environment,
        now: () => now,
        verificationKeys,
      })
    const first = await bind('test', [old]).reservePatientVerification({ email: 'patient@example.test' })
    // Independently checked with OpenSSL HMAC-SHA-256 over the documented UTF-8 input.
    expect(first.correlationDigest).toBe('c1255e2f1a2981d712318d58dc4efbd6e0ae89b5622576d2d37784bab47b09f0')
    const other = await bind('test', [old]).reservePatientVerification({ email: 'patient+tag@example.test' })
    expect(other.id).not.toBe(first.id)
    expect((await bind('local', [old]).reservePatientVerification({ email: 'patient@example.test' })).id).not.toBe(
      first.id,
    )
    expect((await bind('test', [current, old]).reservePatientVerification({ email: 'patient@example.test' })).id).toBe(
      first.id,
    )
    await expect(
      bind('test', [current]).reservePatientVerification({ email: 'patient@example.test' }),
    ).rejects.toMatchObject({
      code: 'correlation-unavailable',
    })
  })

  it('limits new authorized resends without counting technical retries and supersedes only the current unused action', async () => {
    const system = bindAuthActions(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
    })
    const email = 'patient@example.test'
    let current = await system.reservePatientVerification({ email })
    now += 299999
    await expect(system.reservePatientVerification({ email, resendOf: current.id })).rejects.toMatchObject({
      code: 'rate-limited',
    })
    expect((await system.reservePatientVerification({ email })).id).toBe(current.id)
    now += 1
    for (let attempt = 2; attempt <= 5; attempt++) {
      const older = current
      current = await system.reservePatientVerification({ email, resendOf: older.id })
      expect(current.id).not.toBe(older.id)
      expect(await system.read(older.id)).toMatchObject({ state: 'superseded' })
      now += 300000
    }
    await expect(system.reservePatientVerification({ email, resendOf: current.id })).rejects.toMatchObject({
      code: 'rate-limited',
    })
    expect(await system.read(current.id)).toMatchObject({ state: 'pending' })
    expect((await system.reservePatientVerification({ email })).id).toBe(current.id)
    await expect(system.reservePatientVerification({ email, resendOf: 1 })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
  })

  it('removes private correlation at its exact 24-hour boundary without erasing safe terminal history', async () => {
    const system = bindAuthActions(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
    })
    const action = await system.reservePatientVerification({ email: 'patient@example.test' })
    await system.transition({ id: action.id, to: 'revoked' })
    now += day - 1
    await system.sweep()
    expect((await system.read(action.id))!.correlationDigest).toBe(action.correlationDigest)
    now += 1
    await system.sweep()
    expect(await system.read(action.id)).toMatchObject({
      state: 'revoked',
      terminalAt: new Date(start).toISOString(),
      correlationDigest: null,
      correlationKeyVersion: null,
    })
    const rotated = bindAuthActions(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v2', secret: 'synthetic-rotated-material-only-for-tests-v2' }],
    })
    expect((await rotated.reservePatientVerification({ email: 'patient@example.test' })).id).not.toBe(action.id)
  })

  it('clears correlation after patient deletion without changing completion history or blocking other due actions', async () => {
    const system = bindAuthActions(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
    })
    const action = await system.reservePatientVerification({ email: 'patient@example.test' })
    const supabaseSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
    await system.bindSubject({ id: action.id, supabaseSubject })
    await system.transition({ id: action.id, to: 'active' })
    await system.transition({ id: action.id, to: 'confirmed' })
    fixture.principals.set(9, { id: 9, supabaseUserId: supabaseSubject })
    await system.bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } })
    const completed = await system.transition({ id: action.id, to: 'completed' })
    const other = await system.reservePatientVerification({ email: 'other@example.test' })
    // Native relationship deletion updates storage without an AuthAction lifecycle command.
    fixture.rows.set(action.id, { ...fixture.rows.get(action.id)!, principal: null })
    now += day
    expect(await system.sweep()).toEqual({ expired: 1, deleted: 0 })
    expect(await system.read(action.id)).toMatchObject({
      state: 'completed',
      principal: null,
      principalBoundAt: completed.principalBoundAt,
      supabaseSubject,
      subjectBoundAt: completed.subjectBoundAt,
      terminalAt: completed.terminalAt,
      correlationDigest: null,
      correlationKeyVersion: null,
    })
    expect(await system.read(other.id)).toMatchObject({ state: 'expired', correlationDigest: null })
  })

  it('reconciles within the two-page budget without trusting the SDK nextPage', async () => {
    const target: User = {
      id: '26b71580-16be-4f29-9d60-9ec6adc935ce',
      email: 'patient@example.test',
      app_metadata: { user_type: 'patient' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(start).toISOString(),
    }
    const pages: number[] = []
    const client = createClient('https://supabase.example.test', 'synthetic-sdk-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          if (init?.method === 'POST')
            return new Response(JSON.stringify({ message: 'Identity exists' }), { status: 422 })
          const page = Number(new URL(String(input)).searchParams.get('page'))
          pages.push(page)
          const users =
            page < 2
              ? Array.from({ length: 1000 }, (_, index) => ({
                  ...target,
                  email: `other-${page}-${index}@example.test`,
                }))
              : [target]
          return new Response(JSON.stringify({ users }), {
            headers: {
              'content-type': 'application/json',
              'x-total-count': '1001',
              link: `<https://supabase.example.test/auth/v1/admin/users?page=2>; rel="last"${page < 2 ? ', <https://supabase.example.test/auth/v1/admin/users?page=2>; rel="next"' : ''}`,
            },
          })
        },
      },
    })
    const service = bindPendingPatientVerification(fixture.req, {
      environment: 'test',
      now: () => now,
      admin: client.auth.admin,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
    })
    expect(await service.prepare({ email: target.email!, password: 'synthetic-test-password' })).toMatchObject({
      supabaseSubject: target.id,
      state: 'pending',
    })
    expect(pages).toEqual([1, 2])
  })

  it('keeps the reservation after an uncertain identity response and reconciles the same unconfirmed identity on retry', async () => {
    const users: User[] = []
    const admin = {
      createUser: vi.fn(async (input) => {
        if (users.length) throw new Error('Identity already exists')
        users.push({
          id: '26b71580-16be-4f29-9d60-9ec6adc935ce',
          email: input.email,
          app_metadata: input.app_metadata,
          email_confirmed_at: undefined,
        } as User)
        throw new Error('Unknown network result containing private provider content')
      }),
      listUsers: vi
        .fn()
        .mockResolvedValueOnce({ data: { users: [] }, error: null })
        .mockImplementation(async () => ({ data: { users, nextPage: null }, error: null })),
    }
    const service = bindPendingPatientVerification(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
      admin: admin as unknown as SupabaseClient['auth']['admin'],
    })
    const command = { email: 'patient@example.test', password: 'synthetic-test-password' }
    await expect(service.prepare(command)).rejects.toMatchObject({ message: 'identity-unavailable' })
    const pending = await actions().read(1)
    expect(pending).toMatchObject({ state: 'pending', supabaseSubject: null })
    const bound = await service.prepare(command)
    expect(bound).toMatchObject({ id: pending!.id, supabaseSubject: users[0]!.id, state: 'pending' })
    expect(JSON.stringify(bound)).not.toContain(command.email)
    expect(JSON.stringify(bound)).not.toContain(command.password)
    expect(await service.prepare(command)).toEqual(bound)
  })

  it.each([
    {
      email: 'patient@example.test',
      app_metadata: { user_type: 'patient' },
      email_confirmed_at: '2026-10-01T09:00:00.000Z',
    },
    { email: 'patient@example.test', app_metadata: { user_type: 'clinic' }, email_confirmed_at: undefined },
    { email: 'other@example.test', app_metadata: { user_type: 'patient' }, email_confirmed_at: undefined },
  ])('never binds a confirmed, differently typed or different-address identity (%j)', async (identity) => {
    const user: User = {
      id: '26b71580-16be-4f29-9d60-9ec6adc935ce',
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(start).toISOString(),
      ...identity,
    }
    const admin = {
      createUser: vi.fn(async () => ({ data: { user }, error: null })),
      listUsers: vi.fn(async () => ({ data: { users: [user], nextPage: null }, error: null })),
    }
    const service = bindPendingPatientVerification(fixture.req, {
      environment: 'test',
      now: () => now,
      verificationKeys: [{ version: 'test-v1', secret: 'synthetic-correlation-material-only-for-tests' }],
      admin: admin as unknown as SupabaseClient['auth']['admin'],
    })
    await expect(
      service.prepare({ email: 'patient@example.test', password: 'synthetic-test-password' }),
    ).rejects.toMatchObject({ message: 'identity-unavailable' })
    expect(await actions().read(1)).toMatchObject({ state: 'pending', supabaseSubject: null })
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

  it.each(['clinic-invitation', 'clinic-recovery'] as const)(
    'keeps %s callback ownership in the Clinic Dashboard',
    async (actionType) => {
      approvedClinic()
      const action =
        actionType === 'clinic-invitation'
          ? (await actions().reserveClinicInvitation({ clinicStaffId: 61 }))!
          : await actions().create({ actionType, principal: { relationTo: 'clinicStaff', value: 9 } })
      expect(action.callbackDestination).toBe('clinic-dashboard-auth-callback')
      expect((await actions().transition({ id: action.id, to: 'active' })).callbackDestination).toBe(
        'clinic-dashboard-auth-callback',
      )
    },
  )

  it('confirms verification for a bound identity before provisioning the patient, then completes for that patient', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    const supabaseSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
    await actions().bindSubject({ id: action.id, supabaseSubject })
    expect(await actions().transition({ id: action.id, to: 'active' })).toMatchObject({ principal: null })
    expect(await actions().transition({ id: action.id, to: 'confirmed' })).toMatchObject({ principal: null })
    await expect(actions().transition({ id: action.id, to: 'completed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    fixture.principals.set(9, { id: 9, supabaseUserId: supabaseSubject })
    await actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } })
    expect(await actions().transition({ id: action.id, to: 'completed' })).toMatchObject({
      state: 'completed',
      supabaseSubject,
      principal: { relationTo: 'patients', value: 9 },
    })
  })

  it('keeps the first identity binding immutable and idempotent without provisioning early', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    const supabaseSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
    const bound = await actions().bindSubject({ id: action.id, supabaseSubject })
    now += 1000
    expect(await actions().bindSubject({ id: action.id, supabaseSubject })).toEqual(bound)
    await expect(
      actions().bindSubject({ id: action.id, supabaseSubject: '9edb6591-3115-4f1e-a09e-315951ca3628' }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    fixture.principals.set(9, { id: 9, supabaseUserId: supabaseSubject })
    await expect(
      actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    expect(await actions().read(action.id)).toEqual(bound)
  })

  it('rejects a patient belonging to another identity and rechecks the identity before completion', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    const supabaseSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
    await actions().bindSubject({ id: action.id, supabaseSubject })
    await actions().transition({ id: action.id, to: 'active' })
    await actions().transition({ id: action.id, to: 'confirmed' })
    fixture.principals.set(9, { id: 9, supabaseUserId: '9edb6591-3115-4f1e-a09e-315951ca3628' })
    await expect(
      actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } }),
    ).rejects.toMatchObject({ code: 'invalid-transition' })
    fixture.principals.set(9, { id: 9, supabaseUserId: supabaseSubject })
    await actions().bindPrincipal({ id: action.id, principal: { relationTo: 'patients', value: 9 } })
    fixture.principals.set(9, { id: 9, supabaseUserId: '9edb6591-3115-4f1e-a09e-315951ca3628' })
    await expect(actions().transition({ id: action.id, to: 'completed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    fixture.rows.get(action.id)!.principal = null
    await expect(actions().transition({ id: action.id, to: 'completed' })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
  })

  it('rejects expired or non-verification identity binding and excludes it from diagnostics', async () => {
    const action = await actions().create({ actionType: 'patient-verification' })
    const supabaseSubject = '26b71580-16be-4f29-9d60-9ec6adc935ce'
    const recovery = await actions().create({
      actionType: 'patient-recovery',
      principal: { relationTo: 'patients', value: 9 },
    })
    await expect(actions().bindSubject({ id: recovery.id, supabaseSubject })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
    const bound = await actions().bindSubject({ id: action.id, supabaseSubject })
    const req = { ...fixture.req, user: { id: 1, collection: 'platformStaff' } }
    const diagnostics = await AuthActions.hooks!.afterRead![0]!({ doc: bound, req } as never)
    expect(diagnostics).not.toHaveProperty('supabaseSubject')
    expect(diagnostics).not.toHaveProperty('subjectBoundAt')
    const pending = await actions().create({ actionType: 'patient-verification' })
    now += day
    await expect(actions().bindSubject({ id: pending.id, supabaseSubject })).rejects.toMatchObject({
      code: 'invalid-transition',
    })
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
