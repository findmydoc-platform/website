import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'
import type { User } from '@supabase/supabase-js'
import { POST } from '@/app/api/auth/register/patient/route'
import { PREVIEW_GUARD_ACTIVE_REQUEST_HEADER } from '@/features/previewGuard'
import { createEmailCommandStorage } from '../../helpers/emailCommandStorage'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { createFakeDeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { requestPatientVerification } from '@/auth/actions/patientVerificationRequests'

const boundary = vi.hoisted(() => ({
  payload: undefined as unknown as Payload,
  admin: {} as Record<string, ReturnType<typeof vi.fn>>,
}))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  buildConfig: (cfg: unknown) => cfg,
  getPayload: async () => boundary.payload,
  createLocalReq: async (
    { context = {}, req = {}, user }: { context?: object; req?: object; user?: unknown },
    payload: Payload,
  ) => ({ ...req, context, user: user ?? null, payload }),
}))
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: async () => ({ auth: { admin: boundary.admin } }),
  createClient: vi.fn(() => {
    throw new Error('Native signup must not run.')
  }),
}))

const key = { version: 'offline-v1', secret: 'offline-only-verification-registration-key' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const validBody = { email: 'PATIENT@example.test', firstName: 'John', lastName: 'Doe', password: 'OfflinePatient123' } // pragma: allowlist secret
function makeRequest(body: unknown = validBody, previewGuardActive = false) {
  return new Request('http://localhost/api/auth/register/patient', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...(previewGuardActive ? { [PREVIEW_GUARD_ACTIVE_REQUEST_HEADER]: '1' } : {}),
    },
  })
}

describe('patient registration through Auth, catalog, Outbox and offline delivery', () => {
  let storage: ReturnType<typeof createEmailCommandStorage>
  let user: User
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00.000Z'))
    vi.stubEnv('CI', 'false')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('AUTH_VERIFICATION_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [key] }))
    storage = createEmailCommandStorage()
    boundary.payload = storage.payload
    user = {
      id: subject,
      email: 'patient@example.test',
      app_metadata: { user_type: 'patient' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    boundary.admin = {
      createUser: vi.fn(async () => ({ data: { user }, error: null })),
      listUsers: vi.fn(async () => ({ data: { users: [user] }, error: null })),
      getUserById: vi.fn(async () => ({ data: { user }, error: null })),
      generateLink: vi.fn(async () => ({
        data: { user, properties: { verification_type: 'magiclink', hashed_token: 'a'.repeat(64) } },
        error: null,
      })),
      updateUserById: vi.fn(),
      deleteUser: vi.fn(),
    }
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
  const operation = () => [...storage.rows.transactionalEmailOutbox!.values()][0]!

  test('registers without native mail and delivers one package-owned verification email', async () => {
    const response = await POST(makeRequest())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true })
    expect(boundary.admin.createUser).toHaveBeenCalledWith({
      email: 'patient@example.test',
      password: validBody.password,
      email_confirm: false,
      app_metadata: { user_type: 'patient' },
      user_metadata: { first_name: 'John', last_name: 'Doe' },
    })
    expect(operation()).toMatchObject({
      commandType: 'auth.email-verification',
      operationReference: 'v1|auth-action|1',
      state: 'queued',
    })
    expect(boundary.admin.generateLink).not.toHaveBeenCalled()
    const fake = createFakeDeliveryAdapter()
    const deliver = vi.fn(fake.deliver)
    await createTransactionalEmailWorker(storage.req, {
      delivery: { deliver },
      suppression: async () => 'cleared',
    }).run(String(operation().id))
    expect(
      [...storage.rows.transactionalEmailEvents!.values()].map(({ type, outcomeCode }) => ({ type, outcomeCode })),
    ).toContainEqual(expect.objectContaining({ type: 'preparation.completed' }))
    expect(operation()).toMatchObject({ state: 'accepted', providerMessageId: expect.stringMatching(/^fake-/) })
    expect(deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientAddress: user.email,
        subject: 'Verify your email for findmydoc',
        text: expect.stringContaining('authActionId=1'),
      }),
      expect.any(AbortSignal),
    )
    expect(boundary.admin.generateLink).toHaveBeenCalledOnce()
    const message = deliver.mock.calls[0]![0]
    const callback = new URL(
      [...message.html.matchAll(/href="([^"]+)"/g)]
        .map((match) => match[1]!.replaceAll('&amp;', '&'))
        .find((href) => new URL(href).pathname === '/auth/callback')!,
    )
    expect(callback.origin).toBe('https://example.test')
    expect([...callback.searchParams.entries()]).toEqual([
      ['authActionId', '1'],
      ['token_hash', 'a'.repeat(64)],
      ['type', 'magiclink'],
    ])
    expect(message.text).toContain(callback.toString())
  })

  test('technical retries keep the identity, action, prepared link and provider key', async () => {
    await POST(makeRequest())
    await POST(makeRequest())
    expect(storage.rows.authActions!.size).toBe(1)
    expect(storage.rows.transactionalEmailOutbox!.size).toBe(1)
    expect(boundary.admin.createUser).toHaveBeenCalledOnce()
    const fake = createFakeDeliveryAdapter()
    const deliver = vi.fn(fake.deliver).mockResolvedValueOnce({ type: 'retryable' })
    const worker = createTransactionalEmailWorker(storage.req, {
      delivery: { deliver },
      suppression: async () => 'cleared',
    })
    await worker.run(String(operation().id))
    expect(operation().state).toBe('prepared')
    vi.setSystemTime(new Date(Date.now() + 61000))
    await worker.run(String(operation().id))
    expect(operation().state).toBe('accepted')
    expect(deliver.mock.calls[1]![0]).toEqual(deliver.mock.calls[0]![0])
    expect(boundary.admin.generateLink).toHaveBeenCalledOnce()
  })

  test('trusted resend supersedes the old action and suppresses its queued email', async () => {
    await POST(makeRequest())
    vi.setSystemTime(new Date(Date.now() + 301000))
    await requestPatientVerification(storage.req, { ...validBody, resendOf: 1 })
    expect(storage.rows.authActions!.get(1)).toMatchObject({ state: 'superseded' })
    const fake = createFakeDeliveryAdapter()
    const deliver = vi.fn(fake.deliver)
    await createTransactionalEmailWorker(storage.req, {
      delivery: { deliver },
      suppression: async () => 'cleared',
    }).run(String(operation().id))
    expect(operation().state).toBe('suppressed')
    expect(deliver).not.toHaveBeenCalled()
    expect(boundary.admin.updateUserById).not.toHaveBeenCalled()
  })

  test.each(['email', 'role', 'confirmed', 'banned', 'missing'] as const)(
    'suppresses a queued operation when its identity becomes %s',
    async (change) => {
      await POST(makeRequest())
      if (change === 'email') user.email = 'changed@example.test'
      if (change === 'role') user.app_metadata.user_type = 'clinic'
      if (change === 'confirmed') user.email_confirmed_at = new Date().toISOString()
      if (change === 'banned') user.banned_until = new Date(Date.now() + 60000).toISOString()
      if (change === 'missing') boundary.admin.getUserById!.mockResolvedValue({ data: { user: null }, error: null })
      const deliver = vi.fn(createFakeDeliveryAdapter().deliver)
      await createTransactionalEmailWorker(storage.req, {
        delivery: { deliver },
        suppression: async () => 'cleared',
      }).run(String(operation().id))
      expect(operation().state).toBe('suppressed')
      expect(deliver).not.toHaveBeenCalled()
      expect(boundary.admin.generateLink).not.toHaveBeenCalled()
    },
  )

  test.each(['clinic', 'platform', 'confirmed'])(
    'does not change an existing %s identity or expose its existence',
    async (kind) => {
      boundary.admin.createUser!.mockResolvedValue({ data: { user: null }, error: new Error('Already exists') })
      if (kind === 'confirmed') user.email_confirmed_at = new Date().toISOString()
      else user.app_metadata.user_type = kind
      const response = await POST(makeRequest())
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ success: true })
      expect(storage.rows.transactionalEmailOutbox!.size).toBe(0)
      expect(boundary.admin.updateUserById).not.toHaveBeenCalled()
      expect(boundary.admin.deleteUser).not.toHaveBeenCalled()
    },
  )

  test('fails closed before identity creation when hosted verification is not activated', async () => {
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    vi.stubEnv('NODE_ENV', 'development')
    const response = await POST(makeRequest())
    expect(response.status).toBe(503)
    expect(boundary.admin.createUser).not.toHaveBeenCalled()
    expect(storage.rows.authActions!.size).toBe(0)
  })

  test('expires a queued email without generating or sending a late verification link', async () => {
    await POST(makeRequest())
    vi.setSystemTime(new Date(Date.now() + 86400001))
    const deliver = vi.fn(createFakeDeliveryAdapter().deliver)
    await createTransactionalEmailWorker(storage.req, {
      delivery: { deliver },
      suppression: async () => 'cleared',
    }).run(String(operation().id))
    expect(operation().state).toBe('expired')
    expect(deliver).not.toHaveBeenCalled()
    expect(boundary.admin.generateLink).not.toHaveBeenCalled()
  })

  test('a failed outbox write can retry without another identity or action', async () => {
    const create = storage.payload.create as unknown as ReturnType<typeof vi.fn>
    const persistedCreate = create.getMockImplementation() as (options: Record<string, unknown>) => Promise<unknown>
    let fail = true
    create.mockImplementation(async (options) => {
      if (options.collection === 'transactionalEmailEvents' && fail) {
        fail = false
        throw new Error('Offline injected event-write failure')
      }
      return persistedCreate(options)
    })
    expect((await POST(makeRequest())).status).toBe(503)
    expect(storage.rows.transactionalEmailOutbox!.size).toBe(0)
    expect((await POST(makeRequest())).status).toBe(200)
    expect(storage.rows.transactionalEmailOutbox!.size).toBe(1)
    expect(storage.rows.authActions!.size).toBe(1)
    expect(boundary.admin.createUser).toHaveBeenCalledOnce()
    expect(boundary.admin.generateLink).not.toHaveBeenCalled()
  })

  test('preserves Preview Guard and rejects caller-supplied mail or resend authority', async () => {
    expect((await POST(makeRequest(validBody, true))).status).toBe(403)
    for (const injected of [
      { resendOf: 1 },
      { actionUrl: 'https://attacker.example' },
      { recipient: 'other@example.test' },
    ]) {
      expect((await POST(makeRequest({ ...validBody, ...injected }))).status).toBe(400)
    }
    expect(boundary.admin.createUser).not.toHaveBeenCalled()
  })

  test('fails closed with invalid verification keys and does not log credentials', async () => {
    vi.stubEnv('AUTH_VERIFICATION_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'production', keys: [key] }))
    expect((await POST(makeRequest())).status).toBe(503)
    expect(boundary.admin.createUser).not.toHaveBeenCalled()
    const logs = JSON.stringify((storage.payload.logger.warn as ReturnType<typeof vi.fn>).mock.calls)
    expect(logs).not.toContain(key.secret)
    expect(logs).not.toContain(validBody.password)
    expect(logs).not.toContain(user.email)
  })
})
