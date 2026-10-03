import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import type { User } from '@supabase/supabase-js'
import { createEmailCommandStorage } from '../../helpers/emailCommandStorage'
import { requestPatientVerification } from '@/auth/actions/patientVerificationRequests'
import { GET, POST } from '@/app/auth/callback/route'
import { readPatientVerificationContext } from '@/auth/actions/patientVerificationContext'

const boundary = vi.hoisted(() => ({
  payload: undefined as unknown as Payload,
  admin: {} as Record<string, ReturnType<typeof vi.fn>>,
  verify: vi.fn(),
  getUser: vi.fn(),
  setSession: vi.fn(),
}))
vi.mock('payload', async (load) => ({
  ...(await load<typeof import('payload')>()),
  buildConfig: (cfg: unknown) => cfg,
  getPayload: async () => boundary.payload,
  createLocalReq: async ({ context = {}, req = {} }: { context?: object; req?: object }, payload: Payload) => ({
    ...req,
    context,
    user: null,
    payload,
  }),
}))
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createAdminClient: async () => ({ auth: { admin: boundary.admin } }),
  createClient: async () => ({ auth: { getUser: boundary.getUser, setSession: boundary.setSession } }),
  createVerificationClient: () => ({ auth: { verifyOtp: boundary.verify }, commitSession: boundary.setSession }),
}))

const key = { version: 'offline-v1', secret: 'offline-only-verification-completion-key' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const origin = 'https://example.test'
const token = 'a'.repeat(64)
describe('patient verification at the callback HTTP boundary with offline Auth storage', () => {
  let storage: ReturnType<typeof createEmailCommandStorage>
  let user: User
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
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
      user_metadata: { first_name: 'John', last_name: 'Doe' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    boundary.admin = {
      createUser: vi.fn(async () => ({ data: { user }, error: null })),
      listUsers: vi.fn(),
      getUserById: vi.fn(async () => ({ data: { user }, error: null })),
    }
    boundary.verify.mockReset().mockImplementation(async () => {
      user = { ...user, email_confirmed_at: new Date().toISOString() }
      return {
        data: { user, session: { user, access_token: 'offline-access', refresh_token: 'offline-refresh' } },
        error: null,
      }
    })
    boundary.getUser.mockReset().mockImplementation(async () => ({ data: { user }, error: null }))
    boundary.setSession.mockReset().mockResolvedValue({ error: null })
    await requestPatientVerification(storage.req, { email: user.email!, password: 'OfflinePatient123' }) // pragma: allowlist secret
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
  const open = () => GET(new NextRequest(`${origin}/auth/callback?authActionId=1&type=magiclink&token_hash=${token}`))
  async function staged() {
    const response = await open()
    const cookie = response.cookies.get('findmydoc_patient_verification')!
    const context = readPatientVerificationContext(cookie.value, 'test', [key])!
    return { cookie: `${cookie.name}=${cookie.value}`, csrf: context.csrf }
  }
  function submit(context: { cookie: string; csrf: string }, extra: { origin?: string; csrf?: string } = {}) {
    return POST(
      new NextRequest(`${origin}/auth/callback`, {
        method: 'POST',
        headers: { origin: extra.origin ?? origin, 'content-type': 'application/json', cookie: context.cookie },
        body: JSON.stringify({ csrf: extra.csrf ?? context.csrf }),
      }),
    )
  }
  test('opens a token-free confirmation without consuming the token or provisioning a patient', async () => {
    const response = await open()
    expect(response.status).toBe(303)
    expect(response.headers.get('location')).toBe(`${origin}/auth/confirm?type=patient-verification`)
    expect(response.headers.get('set-cookie')).toMatch(/findmydoc_patient_verification=.*HttpOnly/)
    expect(response.headers.get('set-cookie')).toContain('Max-Age=600')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(boundary.verify).not.toHaveBeenCalled()
    expect(storage.payload.create).not.toHaveBeenCalledWith(expect.objectContaining({ collection: 'patients' }))
  })
  test('confirms the intended subject, provisions once, and uses the fixed inquiry destination', async () => {
    const context = await staged()
    const response = await submit(context)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ redirectTo: '/patient/inquiries' })
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect(boundary.verify).toHaveBeenCalledWith({ token_hash: token, type: 'magiclink' })
    expect(boundary.setSession).toHaveBeenCalledOnce()
    const writes = (storage.payload.update as ReturnType<typeof vi.fn>).mock.calls
      .filter(([options]) => options.collection === 'authActions')
      .map(([options]) => options.data.state)
      .filter(Boolean)
    expect(writes).toEqual(['active', 'confirmed', 'completed'])
    expect(
      (storage.payload.create as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([options]) => options.collection === 'patients',
      ),
    ).toHaveLength(1)
    const replay = await submit(context)
    expect(replay.status).toBe(400)
    expect(await replay.json()).toEqual({ code: 'INVALID_OR_EXPIRED_LINK' })
    expect(boundary.verify).toHaveBeenCalledOnce()
  })
  test('conceals private subjects and does not distinguish eligible from unknown actions on GET', async () => {
    const eligible = await open()
    const unknown = await GET(
      new NextRequest(`${origin}/auth/callback?authActionId=2&type=magiclink&token_hash=${token}`),
    )
    const cookie = eligible.cookies.get('findmydoc_patient_verification')!
    expect(Buffer.from(cookie.value.split('.')[1]!, 'base64url').toString()).not.toContain(subject)
    expect(unknown.status).toBe(eligible.status)
    expect(unknown.headers.get('location')).toBe(eligible.headers.get('location'))
    expect(unknown.cookies.get(cookie.name)?.value.length).toBe(cookie.value.length)
    expect(boundary.verify).not.toHaveBeenCalled()
  })
  test.each(['revoked', 'superseded'])(
    'does not install a session when the action becomes %s during token verification',
    async (state) => {
      const verify = boundary.verify.getMockImplementation()!
      boundary.verify.mockImplementation(async () => {
        const result = await verify()
        storage.rows.authActions!.get(1)!.state = state
        return result
      })
      expect((await submit(await staged())).status).toBe(400)
      expect(boundary.setSession).not.toHaveBeenCalled()
    },
  )
  test('shows the neutral invalid state when the bound identity was deleted', async () => {
    const context = await staged()
    boundary.admin.getUserById!.mockResolvedValue({
      data: { user: null },
      error: { status: 404, code: 'user_not_found' },
    })
    expect((await submit(context)).status).toBe(400)
    expect(boundary.verify).not.toHaveBeenCalled()
  })
  test('retains a confirmed receipt when the post-consumption authority recheck is temporarily unavailable', async () => {
    const context = await staged()
    const verify = boundary.verify.getMockImplementation()!
    boundary.verify.mockImplementationOnce(async () => {
      const result = await verify()
      boundary.admin.getUserById!.mockResolvedValueOnce({ data: { user: null }, error: { status: 500 } })
      return result
    })
    const first = await submit(context)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_patient_verification')!
    expect(readPatientVerificationContext(cookie.value, 'test', [key])).toMatchObject({ stage: 'confirmed' })
    expect((await submit({ ...context, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
    expect(boundary.verify).toHaveBeenCalledOnce()
  })
  test('accepts an encrypted pending context signed with a retained rotation key', async () => {
    const context = await staged()
    vi.stubEnv(
      'AUTH_VERIFICATION_CORRELATION_KEYS_JSON',
      JSON.stringify({
        environment: 'test',
        keys: [{ version: 'offline-v2', secret: 'offline-only-new-verification-key' }, key],
      }),
    ) // pragma: allowlist secret
    expect((await submit(context)).status).toBe(200)
  })
  test.each([{ origin: 'https://attacker.example' }, { csrf: 'wrong' }])(
    'rejects untrusted POST %j before consumption',
    async (extra) => {
      expect((await submit(await staged(), extra)).status).toBe(403)
      expect(boundary.verify).not.toHaveBeenCalled()
    },
  )
  test.each([
    'expired',
    'revoked',
    'superseded',
    'completed',
    'flow',
    'environment',
    'subject',
    'destination',
    'email',
    'role',
    'banned',
  ])('rejects a %s action or identity with the same public state', async (change) => {
    const context = await staged()
    const action = storage.rows.authActions!.get(1)!
    if (['expired', 'revoked', 'superseded', 'completed'].includes(change)) action.state = change
    if (change === 'flow') action.actionType = 'patient-recovery'
    if (change === 'environment') action.environment = 'production'
    if (change === 'subject') action.supabaseSubject = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    if (change === 'destination') action.completionRoute = '/admin'
    if (change === 'email') user.email = 'different@example.test'
    if (change === 'role') user.app_metadata.user_type = 'clinic'
    if (change === 'banned') user.banned_until = new Date(Date.now() + 60000).toISOString()
    const response = await submit(context)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'INVALID_OR_EXPIRED_LINK' })
    expect(boundary.verify).not.toHaveBeenCalled()
  })
  test('rejects an expired or tampered pending cookie without touching Supabase', async () => {
    const context = await staged()
    expect((await submit({ ...context, cookie: context.cookie + '0' })).status).toBe(400)
    vi.setSystemTime(new Date(Date.now() + 600000))
    expect((await submit(context)).status).toBe(400)
    expect(boundary.verify).not.toHaveBeenCalled()
  })
  test('does not install a session or provision for a token belonging to another subject', async () => {
    boundary.verify.mockResolvedValue({
      data: {
        user: { ...user, id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', email_confirmed_at: new Date().toISOString() },
        session: {},
      },
      error: null,
    })
    const response = await submit(await staged())
    expect(response.status).toBe(400)
    expect(boundary.setSession).not.toHaveBeenCalled()
    expect(
      (storage.payload.create as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([options]) => options.collection === 'patients',
      ),
    ).toHaveLength(0)
  })
  test.each([429, 500])('keeps completion retryable after a transient session check %i', async (status) => {
    const context = await staged()
    const create = storage.payload.create as unknown as ReturnType<typeof vi.fn>
    const persist = create.getMockImplementation() as (options: Record<string, unknown>) => Promise<unknown>
    let fail = true
    create.mockImplementation(async (options) => {
      if (options.collection === 'patients' && fail) {
        fail = false
        throw new Error('Offline provisioning unavailable')
      }
      return persist(options)
    })
    const first = await submit(context)
    expect(first.status).toBe(503)
    expect(await first.json()).toEqual({ code: 'VERIFICATION_TEMPORARILY_UNAVAILABLE' })
    const receipt = first.cookies.get('findmydoc_patient_verification')!
    expect(Buffer.from(receipt.value.split('.')[1]!, 'base64url').toString()).not.toContain(token)
    vi.setSystemTime(new Date(Date.now() + 601000))
    const confirmed = { ...context, cookie: `${receipt.name}=${receipt.value}` }
    boundary.getUser.mockResolvedValueOnce({ data: { user: null }, error: { status } })
    expect((await submit(confirmed)).status).toBe(503)
    const retried = await submit(confirmed)
    expect(retried.status).toBe(200)
    expect(await retried.json()).toEqual({ redirectTo: '/patient/inquiries' })
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect(boundary.getUser).toHaveBeenCalledTimes(2)
  })
  test('reuses an existing verified-subject patient without creating another record', async () => {
    storage.rows.patients!.set(99, {
      id: 99,
      supabaseUserId: subject,
      email: user.email,
      firstName: 'Existing',
      lastName: 'Patient',
    })
    expect((await submit(await staged())).status).toBe(200)
    expect(
      (storage.payload.create as ReturnType<typeof vi.fn>).mock.calls.filter(
        ([options]) => options.collection === 'patients',
      ),
    ).toHaveLength(0)
    expect((storage.payload.update as ReturnType<typeof vi.fn>).mock.calls).toContainEqual([
      expect.objectContaining({
        collection: 'authActions',
        data: { principal: { relationTo: 'patients', value: 99 }, principalBoundAt: expect.any(String) },
      }),
    ])
  })
  test.each([400, 403, 422, 429, 500])(
    'maps provider rejection %i without disclosing provider content',
    async (status) => {
      boundary.verify.mockResolvedValue({
        data: { user: null, session: null },
        error: { status, message: 'Provider sensitive details' },
      })
      const response = await submit(await staged())
      expect(response.status).toBe(status === 429 || status === 500 ? 503 : 400)
      expect(await response.json()).toEqual({
        code: status === 429 || status === 500 ? 'VERIFICATION_TEMPORARILY_UNAVAILABLE' : 'INVALID_OR_EXPIRED_LINK',
      })
      expect(boundary.setSession).not.toHaveBeenCalled()
    },
  )
  test('rejects malformed, duplicated and caller-selected callback parameters without consumption', async () => {
    for (const query of [
      `authActionId=1&type=magiclink&token_hash=${token}&next=/admin`,
      `authActionId=1&type=magiclink&token_hash=${token}&authActionId=2`,
      `authActionId=1&type=magiclink&type=recovery&token_hash=${token}&next=/auth/password/reset/complete`,
      `authActionId=1&type=recovery&type=magiclink&token_hash=${token}&next=/auth/password/reset/complete`,
      `type=magiclink&token_hash=${token}`,
      `authActionId=1&type=magiclink&token_hash=${token}&code=auth-code`,
      'authActionId=0&type=magiclink&token_hash=bad',
    ]) {
      const response = await GET(new NextRequest(`${origin}/auth/callback?${query}`))
      expect(response.headers.get('location')).toBe(`${origin}/auth/confirm?type=patient-verification`)
      expect(response.cookies.get('findmydoc_patient_verification')?.maxAge).toBe(0)
    }
    expect(boundary.verify).not.toHaveBeenCalled()
  })
})
