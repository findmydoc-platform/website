import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { createEmailCommandStorage } from '../../helpers/emailCommandStorage'
import { dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { requestPasswordRecovery, prepareCommittedRecoveries } from '@/auth/actions/passwordRecoveryRequests'
import { resolveTransactionalEmailEnvironment } from '@/features/transactionalEmail/environment'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { bindTransactionalEmail } from '@/features/transactionalEmail/payloadIntegration'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { createFakeDeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { bindAuthActionProtocol } from '@/auth/actions/protocol/http'
import { resolveAuthActionProtocolKeys, readActionReference } from '@/auth/actions/protocol/credentials'

const mocks = vi.hoisted(() => ({ liveAdmin: vi.fn() }))
vi.mock('@/auth/utilities/supaBaseServer', () => ({ createAdminClient: mocks.liveAdmin }))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  createLocalReq: async (
    { context, req, user }: { context?: object; req?: object; user?: object },
    payload: Payload,
  ) => ({ ...req, context: context ?? {}, user: user ?? null, payload }),
}))
const start = Date.parse('2026-10-03T12:00:00.000Z')
const key = { version: 'offline-v1', secret: 'offline-only-recovery-correlation-material' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const email = 'principal@example.test'
const variants = [
  ['patients', 'Reset your findmydoc patient password', 'https://example.test', 'patient-inquiries'],
  [
    'clinicStaff',
    'Reset your findmydoc Clinic Dashboard password',
    'https://dashboard.example.test',
    'clinic-dashboard',
  ],
  [
    'platformStaff',
    'Reset your findmydoc Platform Administration password',
    'https://example.test',
    'platform-administration',
  ],
] as const
function signedContext(email: string, environment: 'test' | 'ci', clientIP: string, now: number) {
  const body = JSON.stringify({ email, clientIP })
  const timestamp = new Date(now).toISOString()
  const requestId = randomUUID()
  const signature = createHmac('sha256', key.secret)
    .update(
      JSON.stringify([
        'auth-recovery-request-v1',
        environment,
        'POST',
        'requestRecovery',
        timestamp,
        requestId,
        createHash('sha256').update(body).digest('hex'),
      ]),
    )
    .digest('hex')
  return dashboardRecoveryContext(
    { method: 'POST', operation: 'requestRecovery', timestamp, requestId, body, keyVersion: key.version, signature },
    { environment, keys: [key], now: () => now },
  )!
}
function fixture(collection: (typeof variants)[number][0], ci = false) {
  vi.stubEnv('CI', String(ci))
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('VERCEL_ENV', '')
  vi.stubEnv('DEPLOYMENT_ENV', '')
  vi.stubEnv('CLINIC_DASHBOARD_URL', 'https://dashboard.example.test')
  const environment = resolveTransactionalEmailEnvironment()
  expect(environment).toBe(ci ? 'ci' : 'test')
  vi.stubEnv('AUTH_RECOVERY_CORRELATION_KEYS_JSON', JSON.stringify({ environment, keys: [key] }))
  vi.stubEnv(
    'AUTH_ACTION_PROTOCOL_KEYS_JSON',
    JSON.stringify({
      environment,
      service: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
      reference: [{ version: 'current', secret: randomBytes(32).toString('hex') }],
    }),
  )
  let now = start
  vi.setSystemTime(start)
  const store = createEmailCommandStorage()
  store.rows[collection]!.set(61, {
    id: 61,
    email,
    supabaseUserId: subject,
    createdAt: new Date(start).toISOString(),
    status: 'approved',
    authSync: { status: 'synced' },
    role: 'support',
  })
  const body = JSON.stringify({ email, clientIP: '198.51.100.8' })
  const envelope = {
    method: 'POST',
    operation: 'requestRecovery',
    timestamp: new Date(start).toISOString(),
    requestId: '147b07f0-7623-4e46-a657-6e25096d4991',
    body,
    keyVersion: key.version,
    signature: '',
  }
  envelope.signature = createHmac('sha256', key.secret)
    .update(
      JSON.stringify([
        'auth-recovery-request-v1',
        environment,
        envelope.method,
        envelope.operation,
        envelope.timestamp,
        envelope.requestId,
        createHash('sha256').update(body).digest('hex'),
      ]),
    )
    .digest('hex')
  const context = dashboardRecoveryContext(envelope, { environment, keys: [key], now: () => now })!
  const actions = bindAuthActions(store.req, { environment, recoveryKeys: [key], now: () => now })
  return {
    ...store,
    actions,
    context,
    environment,
    principal: store.rows[collection]!.get(61)!,
    now: () => now,
    advance: (milliseconds: number) => {
      now += milliseconds
      vi.setSystemTime(now)
    },
  }
}
afterEach(() => {
  vi.unstubAllEnvs()
  vi.useRealTimers()
  vi.clearAllMocks()
})
describe('recovery from Auth request through the real static catalog and shared offline worker', () => {
  it.each(variants)(
    'delivers the pinned %s recovery template through Fake',
    async (collection, subjectLine, origin, destination) => {
      const store = fixture(collection, true)
      const blockedFetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('External network forbidden'))
      try {
        if (collection === 'clinicStaff') {
          const keys = resolveAuthActionProtocolKeys(store.environment)
          const body = JSON.stringify({ email, clientIP: '198.51.100.8' })
          const timestamp = new Date(start).toISOString()
          const requestId = randomUUID()
          const signature = createHmac('sha256', keys.service[0]!.secret)
            .update(
              JSON.stringify([
                'auth-action-protocol-v1',
                store.environment,
                'POST',
                'requestRecovery',
                timestamp,
                requestId,
                createHash('sha256').update(body).digest('hex'),
              ]),
            )
            .digest('hex')
          const request = new Request('https://website.example.invalid/api/internal/auth-actions/v1/requestRecovery', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-auth-action-timestamp': timestamp,
              'x-auth-action-request-id': requestId,
              'x-auth-action-key-version': 'current',
              'x-auth-action-signature': signature,
            },
            body,
          })
          const handle = bindAuthActionProtocol(store.req, { keys, now: store.now })
          expect((await handle(request.clone(), 'requestRecovery')).status).toBe(202)
          expect((await handle(request, 'requestRecovery')).status).toBe(202)
          expect(store.rows.authActions!.size).toBe(1)
          expect(store.rows.recoveryRequestEvents!.size).toBe(2)
          expect(store.rows.transactionalEmailOutbox!.size).toBe(1)
        } else await requestPasswordRecovery(store.req, { email, context: store.context })
        const action = [...store.rows.authActions!.values()][0]!
        const operation = [...store.rows.transactionalEmailOutbox!.values()][0]!
        expect(action).toMatchObject({ state: 'active', finalDestination: destination, supabaseSubject: subject })
        expect(operation).toMatchObject({
          commandType: 'auth.password-recovery',
          operationReference: `v1|auth-action|${action.id}`,
          runtimeEnvironment: 'ci',
        })
        let prepared: Record<string, unknown> = {}
        await createTransactionalEmailWorker(store.req, {
          now: store.now,
          suppression: async () => 'cleared',
          crashAfterDelivery: () => {
            prepared = structuredClone(store.rows.transactionalEmailOutbox!.get(Number(operation.id))!)
          },
        }).run(String(operation.id))
        expect(store.rows.transactionalEmailOutbox!.get(Number(operation.id))).toMatchObject({ state: 'accepted' })
        const delivered = prepared
        expect(delivered.preparedSubject).toBe(subjectLine)
        const links = [...String(delivered.preparedHtml).matchAll(/href="([^"]+)"/g)].map(
          (match) => new URL(match[1]!.replaceAll('&amp;', '&')),
        )
        const callback = links.find((link) => link.pathname === '/auth/callback')!
        expect(callback.origin).toBe(origin)
        expect(callback.searchParams.get('authActionId')).toBe(String(action.id))
        expect(callback.searchParams.get('next')).toBe('/auth/password/reset/complete')
        expect(callback.searchParams.get('type')).toBe('recovery')
        expect(callback.searchParams.get('token_hash')).toMatch(/^[a-f0-9]{64}$/)
        if (collection === 'clinicStaff')
          expect(
            readActionReference(
              callback.searchParams.get('actionRef')!,
              resolveAuthActionProtocolKeys(store.environment),
            ),
          ).toEqual({ version: 1, actionId: action.id, flow: 'clinic-recovery', environment: store.environment })
        expect(String(delivered.preparedText)).toContain(callback.toString())
        expect(mocks.liveAdmin).not.toHaveBeenCalled()
        expect(blockedFetch).not.toHaveBeenCalled()
      } finally {
        blockedFetch.mockRestore()
      }
    },
  )
  it('expires recovery and clears its recipient correlation at the one-hour boundary', async () => {
    const store = fixture('patients')
    await requestPasswordRecovery(store.req, { email, context: store.context })
    const action = [...store.rows.authActions!.values()][0]!
    store.advance(3600000)
    expect(await store.actions.sweep()).toMatchObject({ expired: 1 })
    expect(store.rows.authActions!.get(Number(action.id))).toMatchObject({
      state: 'expired',
      correlationDigest: null,
      correlationKeyVersion: null,
    })
  })

  it.each([
    [
      'recipient changed',
      (store: ReturnType<typeof fixture>) => {
        store.principal.email = 'changed@example.test'
      },
    ],
    [
      'recipient missing',
      (store: ReturnType<typeof fixture>) => {
        store.principal.email = null
      },
    ],
    [
      'principal missing',
      (store: ReturnType<typeof fixture>) => {
        store.rows.clinicStaff!.clear()
      },
    ],
    [
      'lost role authority',
      (store: ReturnType<typeof fixture>) => {
        store.principal.status = 'disabled'
      },
    ],
    [
      'lost synchronization',
      (store: ReturnType<typeof fixture>) => {
        store.principal.authSync = { status: 'failed' }
      },
    ],
    [
      'reassigned subject',
      (store: ReturnType<typeof fixture>) => {
        store.principal.supabaseUserId = '25196744-bfa8-4947-b341-93df2879220f'
      },
    ],
    [
      'ambiguous email',
      (store: ReturnType<typeof fixture>) => {
        store.rows.patients!.set(71, { ...store.principal, id: 71 })
      },
    ],
    [
      'ambiguous subject',
      (store: ReturnType<typeof fixture>) => {
        store.rows.patients!.set(71, { ...store.principal, id: 71, email: 'other@example.test' })
      },
    ],
  ])('suppresses %s between acceptance and attempt without redirecting it', async (_reason, mutate) => {
    const store = fixture('clinicStaff')
    await requestPasswordRecovery(store.req, { email, context: store.context })
    const operation = [...store.rows.transactionalEmailOutbox!.values()][0]!
    mutate(store)
    const deliver = vi.fn(createFakeDeliveryAdapter().deliver)
    await createTransactionalEmailWorker(store.req, {
      now: store.now,
      delivery: { deliver },
      suppression: async () => 'cleared',
    }).run(String(operation.id))
    expect(store.rows.transactionalEmailOutbox!.get(Number(operation.id))).toMatchObject({ state: 'suppressed' })
    expect(deliver).not.toHaveBeenCalled()
  })

  it('technical retry preserves action, rendered link, prepared bytes, operation and idempotency key', async () => {
    const store = fixture('patients')
    await requestPasswordRecovery(store.req, { email, context: store.context })
    const action = [...store.rows.authActions!.values()][0]!
    const operation = [...store.rows.transactionalEmailOutbox!.values()][0]!
    const fake = createFakeDeliveryAdapter()
    const deliver = vi.fn(fake.deliver).mockResolvedValueOnce({ type: 'retryable', outcomeCode: 'provider-temporary' })
    const worker = createTransactionalEmailWorker(store.req, {
      now: store.now,
      delivery: { deliver },
      suppression: async () => 'cleared',
    })
    await worker.run(String(operation.id))
    const prepared = structuredClone(store.rows.transactionalEmailOutbox!.get(Number(operation.id))!)
    expect(prepared).toMatchObject({ state: 'prepared', attemptCount: 1 })
    expect(
      await bindTransactionalEmail(store.req, undefined, store.now).accept({
        type: 'auth.password-recovery',
        authActionId: Number(action.id),
      }),
    ).toMatchObject({ operationId: String(operation.id), deduplicated: true })
    store.advance(60000)
    await worker.run(String(operation.id))
    expect(deliver).toHaveBeenCalledTimes(2)
    expect(deliver.mock.calls[0]![0]).toEqual(deliver.mock.calls[1]![0])
    expect(deliver.mock.calls[0]![0]).toMatchObject({
      html: prepared.preparedHtml,
      text: prepared.preparedText,
      providerIdempotencyKey: operation.providerIdempotencyKey,
    })
    expect(store.rows.authActions!.size).toBe(1)
    expect(store.rows.authActions!.get(Number(action.id))).toEqual(action)
    expect(store.rows.transactionalEmailOutbox!.size).toBe(1)
    expect(store.rows.transactionalEmailOutbox!.get(Number(operation.id))).toMatchObject({
      state: 'accepted',
      attemptCount: 2,
    })
  })

  it('revalidates current role before a technical retry with already prepared bytes', async () => {
    const store = fixture('clinicStaff')
    await requestPasswordRecovery(store.req, { email, context: store.context })
    const operation = [...store.rows.transactionalEmailOutbox!.values()][0]!
    const deliver = vi
      .fn(createFakeDeliveryAdapter().deliver)
      .mockResolvedValueOnce({ type: 'retryable', outcomeCode: 'provider-temporary' })
    const worker = createTransactionalEmailWorker(store.req, {
      now: store.now,
      delivery: { deliver },
      suppression: async () => 'cleared',
    })
    await worker.run(String(operation.id))
    expect(store.rows.transactionalEmailOutbox!.get(Number(operation.id))).toMatchObject({
      state: 'prepared',
      attemptCount: 1,
    })
    store.principal.status = 'offboarded'
    store.advance(60000)
    await worker.run(String(operation.id))
    expect(deliver).toHaveBeenCalledTimes(1)
    expect(store.rows.transactionalEmailOutbox!.get(Number(operation.id))).toMatchObject({
      state: 'suppressed',
      preparedHtml: null,
    })
  })

  it('recovers interrupted acceptance from the durable action without a new admission', async () => {
    const store = fixture('patients')
    const action = await store.actions.reserveRecovery({ email, context: store.context })
    expect(action?.state).toBe('pending')
    await prepareCommittedRecoveries(store.req, { deadline: start + 30000, now: store.now })
    expect(store.rows.authActions!.get(action!.id)).toMatchObject({ state: 'active' })
    expect(store.rows.transactionalEmailOutbox!.size).toBe(1)
    await prepareCommittedRecoveries(store.req, { deadline: start + 30000, now: store.now })
    expect(store.rows.authActions!.size).toBe(1)
    expect(store.rows.transactionalEmailOutbox!.size).toBe(1)
    expect(store.rows.recoveryRequestEvents!.size).toBe(2)
  })
  it('recovers new interruptions ahead of 25 older real receipts across two time-limited invocations', async () => {
    const store = fixture('patients', true)
    const oldActionIds = new Set<number>()
    for (let index = 0; index < 25; index++) {
      const target = `older-${index}@example.test`
      store.rows.patients!.set(100 + index, {
        ...store.principal,
        id: 100 + index,
        email: target,
        supabaseUserId: randomUUID(),
      })
      await requestPasswordRecovery(store.req, {
        email: target,
        context: signedContext(target, 'ci', `198.51.100.${index + 20}`, store.now()),
      })
    }
    for (const id of store.rows.authActions!.keys()) oldActionIds.add(id)
    expect(store.rows.transactionalEmailOutbox!.size).toBe(25)
    const read = vi.mocked(store.payload.findByID).getMockImplementation()!
    vi.mocked(store.payload.findByID).mockImplementation(async (options) => {
      if (options.collection === 'authActions' && oldActionIds.has(Number(options.id))) store.advance(1500)
      return read(options)
    })
    const interruptions: number[] = []
    for (let index = 0; index < 2; index++) {
      const target = `interrupted-${index}@example.test`
      store.rows.patients!.set(200 + index, {
        ...store.principal,
        id: 200 + index,
        email: target,
        supabaseUserId: randomUUID(),
      })
      const action = await store.actions.reserveRecovery({
        email: target,
        context: signedContext(target, 'ci', `198.51.100.${index + 100}`, store.now()),
      })
      interruptions.push(action!.id)
      await expect(
        prepareCommittedRecoveries(store.req, { deadline: store.now() + 100000, now: store.now }),
      ).rejects.toThrow('Recovery command acceptance unavailable.')
    }
    const sources = [...store.rows.transactionalEmailOutbox!.values()].map(
      (row) => (row.commandPayload as { authActionId: number }).authActionId,
    )
    expect(sources).toEqual(expect.arrayContaining(interruptions))
    expect(store.rows.transactionalEmailOutbox!.size).toBe(27)
    expect(mocks.liveAdmin).not.toHaveBeenCalled()
  })
  it.each(['preview', 'production'])(
    'keeps the real %s command fail-closed without a verified environment binding',
    async (environment) => {
      const store = fixture('patients')
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CI', 'false')
      vi.stubEnv('VERCEL_ENV', environment)
      vi.stubEnv('DEPLOYMENT_ENV', environment)
      vi.stubEnv('AUTH_RECOVERY_CORRELATION_KEYS_JSON', '')
      if (environment === 'preview') {
        await expect(requestPasswordRecovery(store.req, { email, context: store.context })).rejects.toThrow(
          'environment-unavailable',
        )
        await expect(
          prepareCommittedRecoveries(store.req, { deadline: start + 30000, now: store.now }),
        ).rejects.toThrow('environment-unavailable')
      } else {
        await expect(requestPasswordRecovery(store.req, { email, context: store.context })).resolves.toBeUndefined()
        await expect(
          prepareCommittedRecoveries(store.req, { deadline: start + 30000, now: store.now }),
        ).resolves.toBeUndefined()
      }
      expect(store.rows.authActions!.size).toBe(0)
      expect(store.rows.recoveryRequestEvents!.size).toBe(0)
      expect(store.rows.transactionalEmailOutbox!.size).toBe(0)
      expect(mocks.liveAdmin).not.toHaveBeenCalled()
    },
  )
})
