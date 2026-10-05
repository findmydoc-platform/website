import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Payload, PayloadRequest } from 'payload'
import type { User } from '@supabase/supabase-js'
import { AuthActions } from '@/collections/AuthActions'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { bindAuthActionProtocol } from '@/auth/actions/protocol/http'
import { createActionReference, type AuthActionProtocolKeys } from '@/auth/actions/protocol/credentials'
import type { DashboardActionFlow } from '@/auth/actions/contracts'
import { protectAuthActionProtocolStorage } from '@/auth/actions/protocol/storage'
import { recoveryCorrelations } from '@/auth/actions/recoveryCorrelation'
import { guardClinicAccountEvidence, hasClinicAccountCompletion } from '@/auth/utilities/clinicAccountCompletion'

const admission = vi.hoisted(() => ({ request: vi.fn() }))
const passwordAuthority = vi.hoisted(() => ({ getUser: vi.fn(), getClaims: vi.fn() }))
vi.mock('@/auth/utilities/supaBaseServer', () => ({ createClient: async () => ({ auth: passwordAuthority }) }))
vi.mock('@/auth/actions/passwordRecoveryRequests', () => ({ requestPasswordRecovery: admission.request }))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async (options: { context?: object; req?: object }, payload: Payload) => ({
    ...options.req,
    context: options.context ?? {},
    payload,
    user: null,
  }),
}))

const start = Date.parse('2026-10-04T12:00:00.000Z')
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const email = 'synthetic@example.invalid'
const token = 'offline-user-session'
const password = 'offline-password-material'
const keys: AuthActionProtocolKeys = {
  environment: 'test',
  service: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
  reference: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
}
const recoveryKeys = [{ version: 'current', secret: randomBytes(32).toString('hex') }]

// Fake persistence calls the production guards. All flow and transition decisions remain in production code.
function fixture(flow: DashboardActionFlow = 'clinic-invitation') {
  let clock = start
  let nextId = 100
  const records = new Map<string, Record<string, unknown>>()
  const calls: string[] = []
  const correlation = recoveryCorrelations(email, '192.0.2.10', 'test', recoveryKeys)[0]!.correlations[0]!
  const action = {
    id: 42,
    actionType: flow,
    environment: 'test',
    state: 'active',
    principal: { relationTo: 'clinicStaff', value: 61 },
    principalBoundAt: new Date(start).toISOString(),
    supabaseSubject: subject,
    subjectBoundAt: new Date(start).toISOString(),
    ...(flow === 'clinic-recovery'
      ? { correlationDigest: correlation.digest, correlationKeyVersion: correlation.keyVersion }
      : {}),
    supabaseTokenType: flow === 'clinic-invitation' ? 'invite' : 'recovery',
    callbackDestination: 'clinic-dashboard-auth-callback',
    finalDestination: 'clinic-dashboard',
    completionRoute: flow === 'clinic-invitation' ? '/auth/invite/complete' : '/auth/password/reset/complete',
    createdAt: new Date(start).toISOString(),
    expiresAt: new Date(start + (flow === 'clinic-invitation' ? 86400000 : 3600000)).toISOString(),
    terminalAt: null,
    outcomeCode: null,
  }
  const staff = {
    id: 61,
    email,
    supabaseUserId: subject,
    status: 'approved',
    authSync: { status: 'synced' },
    clinic: 3,
    onboardingKey: 'clinic-application:10',
  }
  records.set('authActions:42', action)
  records.set('clinicStaff:61', staff)
  records.set('clinics:3', {
    id: 3,
    status: 'approved',
    participationStatus: 'approved',
    onboardingKey: staff.onboardingKey,
  })
  records.set('clinicApplications:10', {
    id: 10,
    status: 'approved',
    provisioningStatus: 'completed',
    contactEmail: email,
    linkedRecords: { clinic: 3, clinicStaff: 61 },
  })
  const kvConfig = { hooks: { beforeChange: [], beforeDelete: [] } }
  const clone = (value: unknown) => (value == null ? value : structuredClone(value))
  const operation = async (kind: string, input: { collection: string; req: PayloadRequest }) => {
    if (input.collection === 'authActions') {
      for (const hook of AuthActions.hooks!.beforeOperation!)
        await hook({ operation: kind, args: input, req: input.req } as never)
    }
  }
  const afterRead = async (document: Record<string, unknown>, req: PayloadRequest) => {
    let result = clone(document) as Record<string, unknown>
    for (const hook of AuthActions.hooks!.afterRead!) result = await hook({ doc: result, req } as never)
    return result
  }
  const payload = {
    collections: { 'payload-kv': { config: kvConfig } },
    db: {
      beginTransaction: vi.fn(async () => 'owned'),
      commitTransaction: vi.fn(async () => {}),
      rollbackTransaction: vi.fn(async () => {}),
    },
    logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    findByID: vi.fn(async (input) => {
      await operation('read', input)
      const document = records.get(`${input.collection}:${input.id}`)
      return document && input.collection === 'authActions' ? afterRead(document, input.req) : clone(document)
    }),
    find: vi.fn(async (input) => {
      const documents = [...records.entries()]
        .filter(([key]) => key.startsWith(`${input.collection}:`))
        .map(([, value]) => value)
      const matches = documents.filter(
        (doc) =>
          !input.where ||
          Object.entries(input.where).every(([field, conditions]) =>
            Object.entries(conditions as Record<string, unknown>).every(([operator, value]) => {
              if (operator === 'equals') return doc[field] === value
              if (operator === 'like') return String(doc[field]).includes(String(value))
              if (operator === 'in') return (value as unknown[]).includes(doc[field])
              if (operator === 'not_equals') return doc[field] !== value
              throw new Error('Unsupported fake storage predicate.')
            }),
          ),
      )
      return { docs: matches.slice(0, input.limit ?? matches.length).map(clone) }
    }),
    create: vi.fn(async (input) => {
      if (input.collection !== 'payload-kv') throw new Error('Unexpected fake create.')
      for (const hook of kvConfig.hooks.beforeChange as Array<(input: unknown) => Promise<unknown>>)
        await hook({ operation: 'create', data: input.data, req: input.req })
      if ([...records.values()].some((doc) => doc.key === input.data.key))
        throw Object.assign(new Error('Unique key conflict.'), { code: '23505' })
      const doc = { ...(clone(input.data) as object), id: nextId++ }
      records.set(`payload-kv:${doc.id}`, doc)
      return clone(doc)
    }),
    update: vi.fn(async (input) => {
      await operation('update', input)
      const originalDoc = records.get(`${input.collection}:${input.id}`)!
      let data = clone(input.data) as Record<string, unknown>
      if (input.collection === 'clinicStaff') {
        data = guardClinicAccountEvidence({
          operation: 'update',
          data,
          originalDoc,
          req: { ...input.req, context: input.context },
        } as never) as Record<string, unknown>
        Object.assign(originalDoc, data)
        calls.push('account-completion')
        return clone(originalDoc)
      }
      for (const hook of AuthActions.hooks!.beforeChange!)
        data = await hook({ operation: 'update', data, originalDoc, req: input.req } as never)
      Object.assign(originalDoc, data)
      calls.push(`action:${data.state}`)
      return afterRead(originalDoc, input.req)
    }),
    delete: vi.fn(async (input) => {
      for (const hook of kvConfig.hooks.beforeDelete as Array<(input: unknown) => Promise<void>>)
        await hook({ id: input.id, req: input.req })
      records.delete(`${input.collection}:${input.id}`)
    }),
  } as unknown as Payload
  protectAuthActionProtocolStorage(payload)
  const req = { payload, context: {} } as PayloadRequest
  const user = {
    id: subject,
    email,
    app_metadata: { user_type: 'clinic' },
    user_metadata: {},
    aud: 'authenticated',
    created_at: new Date(start).toISOString(),
  } as User
  const verifyUser = vi.fn(async () => user)
  const updatePassword = vi.fn(async () => {
    calls.push('password')
    return { data: { user }, error: null }
  })
  passwordAuthority.getUser.mockResolvedValue({ data: { user }, error: null })
  passwordAuthority.getClaims.mockImplementation(async () => ({
    data: { claims: { sub: subject, amr: [{ method: 'password', timestamp: Math.floor(Date.now() / 1000) }] } },
    error: null,
  }))
  const authenticatePassword = vi.fn(async () => ({ accessToken: 'offline-fresh-password-session', subject }))
  const handle = bindAuthActionProtocol(req, {
    keys,
    now: () => clock,
    recoveryKeys,
    verifyUser,
    updatePassword,
    authenticatePassword,
  })
  const actionRef = createActionReference({ actionId: 42, flow }, keys)
  const body = { actionRef, flow }
  const authenticatedBody = { ...body, accessToken: token }
  const completeBody = { ...authenticatedBody, password }
  const request = (
    operation: string,
    value: unknown,
    options: { id?: string; timestamp?: number; method?: string; environment?: string; tamper?: string } = {},
  ) => {
    const serialized = JSON.stringify(value)
    const timestamp = new Date(options.timestamp ?? start).toISOString()
    const requestId = options.id ?? randomUUID()
    const method = options.method ?? 'POST'
    const signature = createHmac('sha256', keys.service[0]!.secret)
      .update(
        JSON.stringify([
          'auth-action-protocol-v1',
          options.environment ?? 'test',
          method,
          operation,
          timestamp,
          requestId,
          createHash('sha256').update(serialized).digest('hex'),
        ]),
      )
      .digest('hex')
    return new Request('https://website.example.invalid/api/internal/auth-actions/v1/' + operation, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-auth-action-timestamp': timestamp,
        'x-auth-action-request-id': requestId,
        'x-auth-action-key-version': 'current',
        'x-auth-action-signature': signature,
      },
      body: options.tamper ?? serialized,
    })
  }
  return {
    req,
    action,
    staff,
    user,
    records,
    calls,
    verifyUser,
    updatePassword,
    authenticatePassword,
    handle,
    request,
    body,
    authenticatedBody,
    completeBody,
    setNow: (time: number) => {
      clock = time
    },
    actions: bindAuthActions(req, { environment: 'test', now: () => clock, recoveryKeys }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  admission.request.mockResolvedValue(undefined)
})
const safeInvalid = { version: 1, ok: false, code: 'INVALID_OR_EXPIRED_ACTION' }
describe('Website auth-action HTTP protocol', () => {
  it('records guarded initial account completion before acknowledging an invitation password', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(200)
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(true)
    expect(f.authenticatePassword).toHaveBeenCalledWith(email, password)
    expect(passwordAuthority.getUser).toHaveBeenCalledWith('offline-fresh-password-session')
    expect(passwordAuthority.getClaims).toHaveBeenCalledWith('offline-fresh-password-session')
    expect(JSON.stringify([...f.records.values()])).not.toContain('offline-fresh-password-session')
  })

  it('resumes initial evidence after fresh password authentication fails without repeating password persistence', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    f.authenticatePassword.mockRejectedValueOnce(new Error('Synthetic password authentication outage.'))
    const completion = f.request('completeAction', f.completeBody)
    const unavailable = await f.handle(completion.clone(), 'completeAction')
    expect(unavailable.status).toBe(503)
    expect(unavailable.headers.get('Cache-Control')).toBe('private, no-store')
    expect(f.action.state).toBe('completed')
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(false)
    expect(
      [...f.records.values()].some((doc) => String(doc.key).includes('auth-action-password:v1:test:subject:')),
    ).toBe(true)
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(200)
    expect((await f.handle(completion, 'completeAction')).status).toBe(200)
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(true)
    expect(f.updatePassword).toHaveBeenCalledOnce()
    expect(
      [...f.records.values()].some((doc) => String(doc.key).includes('auth-action-password:v1:test:subject:')),
    ).toBe(false)
  })

  it.each(['login-subject', 'verified-subject', 'email-session', 'tenant-change', 'synchronization-change'] as const)(
    'does not acknowledge invitation evidence for %s',
    async (condition) => {
      const f = fixture()
      await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
      if (condition === 'login-subject')
        f.authenticatePassword.mockResolvedValueOnce({
          accessToken: 'offline-fresh-password-session',
          subject: randomUUID(),
        })
      if (condition === 'verified-subject')
        passwordAuthority.getUser.mockResolvedValueOnce({
          data: { user: { ...f.user, id: randomUUID() } },
          error: null,
        })
      if (condition === 'email-session')
        passwordAuthority.getClaims.mockResolvedValueOnce({
          data: { claims: { sub: subject, amr: [{ method: 'otp', timestamp: Math.floor(Date.now() / 1000) }] } },
          error: null,
        })
      if (condition === 'tenant-change' || condition === 'synchronization-change')
        f.authenticatePassword.mockImplementationOnce(async () => {
          if (condition === 'tenant-change') {
            f.records.set('clinics:999', {
              id: 999,
              status: 'pending',
              participationStatus: 'approved',
              onboardingKey: f.staff.onboardingKey,
            })
            f.staff.clinic = 999
          } else f.staff.authSync.status = 'failed'
          return { accessToken: 'offline-fresh-password-session', subject }
        })
      expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(503)
      expect(hasClinicAccountCompletion(f.staff as never)).toBe(false)
      expect(f.updatePassword).toHaveBeenCalledOnce()
    },
  )

  it('never creates initial completion proof through password recovery', async () => {
    const f = fixture('clinic-recovery')
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(200)
    expect(f.authenticatePassword).not.toHaveBeenCalled()
    expect(passwordAuthority.getClaims).not.toHaveBeenCalled()
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(false)
  })

  it('keeps initial evidence bound to its action on completed retries', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    const completion = f.request('completeAction', f.completeBody)
    expect((await f.handle(completion.clone(), 'completeAction')).status).toBe(200)
    Object.assign(f.staff, { accountCompletion: { ...Reflect.get(f.staff, 'accountCompletion'), authActionId: '999' } })
    expect((await f.handle(completion, 'completeAction')).status).toBe(400)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('retains password success through an evidence write outage and resumes its guarded write', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    const originalUpdate = vi.mocked(f.req.payload.update).getMockImplementation()!
    let failEvidence = true
    vi.mocked(f.req.payload.update).mockImplementation(async (input) => {
      if (input.collection === 'clinicStaff' && failEvidence) {
        failEvidence = false
        throw new Error('Synthetic evidence storage outage.')
      }
      return originalUpdate(input)
    })
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(503)
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(false)
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(200)
    expect(hasClinicAccountCompletion(f.staff as never)).toBe(true)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })
  it.each(['clinic-invitation', 'clinic-recovery'] as const)(
    'reads, confirms and completes %s only after the Website observes password success',
    async (flow) => {
      const f = fixture(flow)
      expect(await (await f.handle(f.request('validateAction', f.body), 'validateAction')).json()).toMatchObject({
        outcome: 'valid',
      })
      expect(f.action.state).toBe('active')
      expect(f.req.payload.update).not.toHaveBeenCalled()
      expect(
        await (await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')).json(),
      ).toMatchObject({ outcome: 'confirmed' })
      const retry = f.request('completeAction', f.completeBody)
      expect(await (await f.handle(retry.clone(), 'completeAction')).json()).toMatchObject({ outcome: 'completed' })
      expect(await (await f.handle(retry, 'completeAction')).json()).toMatchObject({ outcome: 'completed' })
      expect(f.calls).toEqual([
        'action:confirmed',
        'password',
        'action:completed',
        ...(flow === 'clinic-invitation' ? ['account-completion'] : []),
      ])
      expect(f.updatePassword).toHaveBeenCalledOnce()
      expect(JSON.stringify([...f.records.values()])).not.toContain(password)
      expect(JSON.stringify([...f.records.values()])).not.toContain(token)
      expect(f.req.payload.logger.error).not.toHaveBeenCalled()
    },
  )

  it('passes the original client IP only through authenticated recovery admission and admits exact retries once', async () => {
    const f = fixture()
    const body = { email, clientIP: '192.0.2.10' }
    const request = f.request('requestRecovery', body)
    expect((await f.handle(request.clone(), 'requestRecovery')).status).toBe(202)
    expect((await f.handle(request, 'requestRecovery')).status).toBe(202)
    expect(admission.request).toHaveBeenCalledOnce()
    const input = admission.request.mock.calls[0]![1]
    expect(input.actionType).toBe('clinic-recovery')
    expect(JSON.stringify(input.context)).toBe('{}')
    expect(JSON.stringify([...f.records.values()])).not.toContain('192.0.2.10')
    expect(JSON.stringify([...f.records.entries()].filter(([key]) => key.startsWith('payload-kv:')))).not.toContain(
      email,
    )
  })

  it.each(['tampered', 'stale', 'future', 'environment', 'method', 'large-body'] as const)(
    'rejects %s before any storage, provider or recovery effect',
    async (condition) => {
      const f = fixture()
      const options =
        condition === 'tampered'
          ? { tamper: JSON.stringify({ ...f.body, actionRef: 'changed' }) }
          : condition === 'stale'
            ? { timestamp: start - 300000 }
            : condition === 'future'
              ? { timestamp: start + 1 }
              : condition === 'environment'
                ? { environment: 'production' }
                : condition === 'method'
                  ? { method: 'PUT' }
                  : { tamper: 'x'.repeat(16385) }
      expect(await (await f.handle(f.request('validateAction', f.body, options), 'validateAction')).json()).toEqual(
        safeInvalid,
      )
      expect(f.req.payload.find).not.toHaveBeenCalled()
      expect(f.req.payload.create).not.toHaveBeenCalled()
      expect(f.verifyUser).not.toHaveBeenCalled()
      expect(admission.request).not.toHaveBeenCalled()
    },
  )

  it.each(['completed', 'expired', 'revoked', 'superseded', 'confirmed', 'pending'] as const)(
    'returns the same safe outcome for %s validation',
    async (state) => {
      const f = fixture()
      Object.assign(f.action, {
        state,
        terminalAt: ['completed', 'expired', 'revoked', 'superseded'].includes(state)
          ? new Date(start).toISOString()
          : null,
        outcomeCode: state === 'superseded' ? 'superseded' : null,
      })
      const request = f.request('validateAction', f.body)
      expect(await (await f.handle(request.clone(), 'validateAction')).json()).toEqual(safeInvalid)
      expect(await (await f.handle(request, 'validateAction')).json()).toEqual(safeInvalid)
      expect(f.req.payload.update).not.toHaveBeenCalled()
    },
  )

  it.each(['subject', 'role', 'recipient', 'flow', 'reference', 'expiry'] as const)(
    'rejects a mismatched %s without advancing the action',
    async (condition) => {
      const f = fixture()
      const body = { ...f.authenticatedBody }
      if (condition === 'subject') f.user.id = randomUUID()
      if (condition === 'role') f.user.app_metadata.user_type = 'patient'
      if (condition === 'recipient') f.staff.email = 'changed@example.invalid'
      if (condition === 'flow') body.flow = 'clinic-recovery'
      if (condition === 'reference') body.actionRef += 'x'
      if (condition === 'expiry') f.setNow(Date.parse(f.action.expiresAt))
      const request = f.request('confirmAction', body, {
        timestamp: condition === 'expiry' ? Date.parse(f.action.expiresAt) : start,
      })
      expect(await (await f.handle(request, 'confirmAction')).json()).toEqual(safeInvalid)
      expect(f.req.payload.update).not.toHaveBeenCalled()
      expect(f.updatePassword).not.toHaveBeenCalled()
    },
  )

  it('rejects a different otherwise valid body under the same request ID', async () => {
    const f = fixture()
    const id = randomUUID()
    expect((await f.handle(f.request('confirmAction', f.authenticatedBody, { id }), 'confirmAction')).status).toBe(200)
    const different = { ...f.authenticatedBody, accessToken: 'another-valid-offline-session' }
    expect(await (await f.handle(f.request('confirmAction', different, { id }), 'confirmAction')).json()).toEqual(
      safeInvalid,
    )
    // The same changed body is a valid confirmation retry when it has its own request ID.
    expect((await f.handle(f.request('confirmAction', different), 'confirmAction')).status).toBe(200)
    expect(f.req.payload.update).toHaveBeenCalledOnce()
  })

  it('rechecks active state on exact validation retries after confirmation', async () => {
    const f = fixture()
    const id = randomUUID()
    expect((await f.handle(f.request('validateAction', f.body, { id }), 'validateAction')).status).toBe(200)
    expect((await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')).status).toBe(200)
    expect(await (await f.handle(f.request('validateAction', f.body, { id }), 'validateAction')).json()).toEqual(
      safeInvalid,
    )
  })

  it('does not accept browser completion flags or complete an active action', async () => {
    const f = fixture()
    expect(
      await (
        await f.handle(f.request('completeAction', { ...f.completeBody, passwordCompleted: true }), 'completeAction')
      ).json(),
    ).toEqual(safeInvalid)
    expect(await (await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).json()).toEqual(
      safeInvalid,
    )
    expect(f.updatePassword).not.toHaveBeenCalled()
  })

  it('preserves the original confirmation timestamp and checks the current subject on exact retries', async () => {
    const f = fixture()
    const request = f.request('confirmAction', f.authenticatedBody)
    expect((await f.handle(request.clone(), 'confirmAction')).status).toBe(200)
    const original = JSON.stringify(f.action)
    expect((await f.handle(request.clone(), 'confirmAction')).status).toBe(200)
    expect(JSON.stringify(f.action)).toBe(original)
    expect(f.req.payload.update).toHaveBeenCalledOnce()
    f.user.id = randomUUID()
    expect(await (await f.handle(request, 'confirmAction')).json()).toEqual(safeInvalid)
  })

  it('keeps a provider failure and lost response from authorizing another password attempt', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    f.updatePassword.mockRejectedValueOnce(new Error('synthetic uncertain provider outcome'))
    const request = f.request('completeAction', f.completeBody)
    expect((await f.handle(request.clone(), 'completeAction')).status).toBe(503)
    expect((await f.handle(request, 'completeAction')).status).toBe(503)
    expect(
      (await f.handle(f.request('completeAction', { ...f.completeBody, password: 'different' }), 'completeAction'))
        .status,
    ).toBe(503)
    expect(f.action.state).toBe('confirmed')
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('resumes a known successful password result after lifecycle failure without repeating the password call', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    vi.mocked(f.req.payload.update).mockRejectedValueOnce(new Error('synthetic lifecycle outage'))
    const request = f.request('completeAction', f.completeBody)
    expect((await f.handle(request.clone(), 'completeAction')).status).toBe(503)
    expect((await f.handle(request, 'completeAction')).status).toBe(200)
    expect(f.action.state).toBe('completed')
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('reconciles committed confirmation and completion after a lost receipt acknowledgement without repeating writes', async () => {
    const f = fixture()
    const originalCreate = vi.mocked(f.req.payload.create).getMockImplementation()!
    vi.mocked(f.req.payload.create).mockImplementation(async (input) => {
      if (input.collection === 'payload-kv' && String(Reflect.get(input.data, 'key')).includes(':receipt:'))
        throw new Error('Synthetic receipt outage.')
      return originalCreate(input)
    })
    const confirm = f.request('confirmAction', f.authenticatedBody)
    expect((await f.handle(confirm.clone(), 'confirmAction')).status).toBe(503)
    expect((await f.handle(confirm, 'confirmAction')).status).toBe(200)
    const complete = f.request('completeAction', f.completeBody)
    expect((await f.handle(complete.clone(), 'completeAction')).status).toBe(503)
    expect((await f.handle(complete, 'completeAction')).status).toBe(200)
    expect(f.calls).toEqual(['action:confirmed', 'password', 'action:completed', 'account-completion'])
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('rejects a completed retry after current principal authority changes', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    const complete = f.request('completeAction', f.completeBody)
    expect((await f.handle(complete.clone(), 'completeAction')).status).toBe(200)
    f.staff.email = 'changed@example.invalid'
    expect(await (await f.handle(complete, 'completeAction')).json()).toEqual(safeInvalid)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('permits a corrected password only after a definitive pre-persistence rejection', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    f.updatePassword.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 422, code: 'weak_password' },
    } as never)
    const first = f.request('completeAction', f.completeBody)
    expect(await (await f.handle(first.clone(), 'completeAction')).json()).toEqual(safeInvalid)
    expect(await (await f.handle(first, 'completeAction')).json()).toEqual(safeInvalid)
    expect(
      (
        await f.handle(
          f.request('completeAction', { ...f.completeBody, password: 'corrected-offline-password' }),
          'completeAction',
        )
      ).status,
    ).toBe(200)
    expect(f.updatePassword).toHaveBeenCalledTimes(2)
  })

  it('excludes a competing completion while the first password operation is pending', async () => {
    const f = fixture()
    await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let began!: () => void
    const started = new Promise<void>((resolve) => {
      began = resolve
    })
    f.updatePassword.mockImplementationOnce(async () => {
      began()
      await pending
      return { data: { user: f.user }, error: null }
    })
    const first = f.handle(f.request('completeAction', f.completeBody), 'completeAction')
    await started
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(503)
    release()
    expect((await first).status).toBe(200)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('excludes parallel invitation and recovery password writers for the same subject', async () => {
    const f = fixture()
    const recovery = {
      ...f.action,
      id: 43,
      actionType: 'clinic-recovery',
      supabaseTokenType: 'recovery',
      completionRoute: '/auth/password/reset/complete',
      expiresAt: new Date(start + 3600000).toISOString(),
      correlationDigest: recoveryCorrelations(email, '', 'test', recoveryKeys)[0]!.correlations[0]!.digest,
      correlationKeyVersion: 'current',
    }
    f.records.set('authActions:43', recovery)
    const recoveryBody = {
      actionRef: createActionReference({ actionId: 43, flow: 'clinic-recovery' }, keys),
      flow: 'clinic-recovery',
      accessToken: token,
    }
    expect((await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')).status).toBe(200)
    expect((await f.handle(f.request('confirmAction', recoveryBody), 'confirmAction')).status).toBe(200)
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    let began!: () => void
    const started = new Promise<void>((resolve) => {
      began = resolve
    })
    f.updatePassword.mockImplementationOnce(async () => {
      began()
      await pending
      return { data: { user: f.user }, error: null }
    })
    const competingRequest = f.request('completeAction', { ...recoveryBody, password })
    const first = f.handle(f.request('completeAction', f.completeBody), 'completeAction')
    await started
    try {
      expect((await f.handle(competingRequest.clone(), 'completeAction')).status).toBe(503)
      expect(recovery.state).toBe('confirmed')
      expect(f.updatePassword).toHaveBeenCalledOnce()
    } finally {
      release()
    }
    expect((await first).status).toBe(200)
    expect(f.action.state).toBe('completed')
    expect(recovery.state).toBe('revoked')
    expect(await (await f.handle(competingRequest, 'completeAction')).json()).toEqual(safeInvalid)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it.each(['clinic-invitation', 'clinic-recovery'] as const)(
    'revokes a previously confirmed %s when the other flow completes, while allowing later recovery',
    async (staleFlow) => {
      const f = fixture(staleFlow)
      const successfulFlow = staleFlow === 'clinic-invitation' ? 'clinic-recovery' : 'clinic-invitation'
      const other = {
        ...f.action,
        id: 43,
        actionType: successfulFlow,
        supabaseTokenType: successfulFlow === 'clinic-recovery' ? 'recovery' : 'invite',
        completionRoute:
          successfulFlow === 'clinic-recovery' ? '/auth/password/reset/complete' : '/auth/invite/complete',
        expiresAt: new Date(start + (successfulFlow === 'clinic-recovery' ? 3600000 : 86400000)).toISOString(),
        correlationDigest:
          successfulFlow === 'clinic-recovery'
            ? recoveryCorrelations(email, '', 'test', recoveryKeys)[0]!.correlations[0]!.digest
            : undefined,
        correlationKeyVersion: successfulFlow === 'clinic-recovery' ? 'current' : undefined,
      }
      f.records.set('authActions:43', other)
      const otherBody = {
        actionRef: createActionReference({ actionId: 43, flow: successfulFlow }, keys),
        flow: successfulFlow,
        accessToken: token,
      }
      const staleConfirmation = f.request('confirmAction', f.authenticatedBody)
      expect((await f.handle(staleConfirmation.clone(), 'confirmAction')).status).toBe(200)
      expect((await f.handle(f.request('confirmAction', otherBody), 'confirmAction')).status).toBe(200)
      const completedRequest = f.request('completeAction', { ...otherBody, password })
      expect((await f.handle(completedRequest.clone(), 'completeAction')).status).toBe(200)
      expect(f.action.state).toBe('revoked')
      expect(other.state).toBe('completed')
      expect(await (await f.handle(staleConfirmation, 'confirmAction')).json()).toEqual(safeInvalid)
      expect(await (await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).json()).toEqual(
        safeInvalid,
      )
      expect((await f.handle(completedRequest, 'completeAction')).status).toBe(200)
      expect(f.updatePassword).toHaveBeenCalledOnce()

      f.setNow(start + 1000)
      const later = {
        ...other,
        id: 44,
        actionType: 'clinic-recovery',
        supabaseTokenType: 'recovery',
        completionRoute: '/auth/password/reset/complete',
        state: 'active',
        createdAt: new Date(start + 1000).toISOString(),
        expiresAt: new Date(start + 3601000).toISOString(),
        terminalAt: null,
        correlationDigest: recoveryCorrelations(email, '', 'test', recoveryKeys)[0]!.correlations[0]!.digest,
        correlationKeyVersion: 'current',
      }
      f.records.set('authActions:44', later)
      const laterBody = {
        actionRef: createActionReference({ actionId: 44, flow: 'clinic-recovery' }, keys),
        flow: 'clinic-recovery',
        accessToken: token,
      }
      expect(
        (await f.handle(f.request('confirmAction', laterBody, { timestamp: start + 1000 }), 'confirmAction')).status,
      ).toBe(200)
      expect(
        (
          await f.handle(
            f.request('completeAction', { ...laterBody, password }, { timestamp: start + 1000 }),
            'completeAction',
          )
        ).status,
      ).toBe(200)
      expect(f.updatePassword).toHaveBeenCalledTimes(2)
    },
  )

  it('revokes only outstanding clinic actions for the completed subject in its environment', async () => {
    const f = fixture()
    const outstanding = ['pending', 'active', 'confirmed'].map((state, index) => {
      const action = { ...f.action, id: 51 + index, state }
      f.records.set(`authActions:${action.id}`, action)
      return action
    })
    const unrelated = [
      { ...f.action, id: 54, supabaseSubject: randomUUID() },
      { ...f.action, id: 55, environment: 'preview' },
      { ...f.action, id: 56, actionType: 'patient-recovery' },
      { ...f.action, id: 57, state: 'completed', terminalAt: new Date(start).toISOString() },
    ]
    const originals = structuredClone(unrelated)
    for (const action of unrelated) f.records.set(`authActions:${action.id}`, action)
    expect((await f.handle(f.request('confirmAction', f.authenticatedBody), 'confirmAction')).status).toBe(200)
    expect((await f.handle(f.request('completeAction', f.completeBody), 'completeAction')).status).toBe(200)
    expect(outstanding.map((action) => action.state)).toEqual(['revoked', 'revoked', 'revoked'])
    expect(unrelated).toEqual(originals)
    expect(f.updatePassword).toHaveBeenCalledOnce()
  })

  it('protects protocol KV claims from a caller-supplied capability and preserves other KV namespaces', async () => {
    const f = fixture()
    await expect(
      f.req.payload.create({
        collection: 'payload-kv',
        req: { ...f.req, context: { authActionProtocolKV: {} } },
        overrideAccess: true,
        data: { key: 'auth-action-protocol:v1:test:request:forged', data: {} },
      }),
    ).rejects.toThrow('Protocol storage is private.')
    await expect(
      f.req.payload.create({
        collection: 'payload-kv',
        req: f.req,
        overrideAccess: true,
        data: { key: 'seed:synthetic-run', data: {} },
      }),
    ).resolves.toBeDefined()
  })
})
