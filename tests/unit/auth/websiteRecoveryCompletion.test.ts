import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { createEmailCommandStorage } from '../../helpers/emailCommandStorage'
import { GET, POST } from '@/app/auth/callback/route'
import { readWebsiteRecoveryContext } from '@/auth/actions/websiteRecoveryContext'
import { requestPasswordRecovery } from '@/auth/actions/passwordRecoveryRequests'
import { dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { POST as completePassword } from '@/app/auth/password/complete/route'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'

const boundary = vi.hoisted(() => ({
  payload: undefined as unknown as Payload,
  verify: vi.fn(),
  adminUser: vi.fn(),
  getUser: vi.fn(),
  commit: vi.fn(),
  update: vi.fn(),
  signOut: vi.fn(),
  clear: vi.fn(),
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
  createClient: async () => ({
    auth: {
      getUser: boundary.getUser,
      getSession: async () => ({ data: { session: { access_token: 'synthetic-access-token' } }, error: null }),
      updateUser: boundary.update,
    },
  }),
  createAdminClient: async () => ({ auth: { admin: { getUserById: boundary.adminUser } } }),
  createVerificationClient: () => ({ auth: { verifyOtp: boundary.verify }, commitSession: boundary.commit }),
  clearLocalAuthSession: boundary.clear,
  signOutRecoverySession: boundary.signOut,
}))

const key = { version: 'offline-v1', secret: 'offline-only-recovery-completion-material' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const origin = 'https://example.test'
describe('Website recovery at the callback HTTP boundary', () => {
  let storage: ReturnType<typeof createEmailCommandStorage>
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    vi.stubEnv('CI', 'false')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('AUTH_RECOVERY_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [key] }))
    storage = createEmailCommandStorage()
    boundary.payload = storage.payload
    boundary.verify.mockReset()
    boundary.commit.mockReset().mockResolvedValue(undefined)
    boundary.clear.mockReset().mockResolvedValue(undefined)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })
  async function recovery(collection: 'patients' | 'platformStaff') {
    const email = 'principal@example.test'
    storage.rows[collection]!.set(61, {
      id: 61,
      email,
      supabaseUserId: subject,
      role: 'support',
      createdAt: new Date().toISOString(),
    })
    const body = JSON.stringify({ email, clientIP: '198.51.100.8' })
    const timestamp = new Date().toISOString()
    const requestId = randomUUID()
    const signature = createHmac('sha256', key.secret)
      .update(
        JSON.stringify([
          'auth-recovery-request-v1',
          'test',
          'POST',
          'requestRecovery',
          timestamp,
          requestId,
          createHash('sha256').update(body).digest('hex'),
        ]),
      )
      .digest('hex')
    const context = dashboardRecoveryContext(
      { method: 'POST', operation: 'requestRecovery', timestamp, requestId, body, keyVersion: key.version, signature },
      { environment: 'test', keys: [key] },
    )
    await requestPasswordRecovery(storage.req, { email, context })
    const user = {
      id: subject,
      email,
      app_metadata: { user_type: collection === 'patients' ? 'patient' : 'platform' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    boundary.adminUser.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.getUser.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.verify.mockResolvedValue({ data: { user, session: { user } }, error: null })
    boundary.update.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.signOut.mockReset().mockResolvedValue({ error: null })
    const id = Number([...storage.rows.authActions!.values()][0]!.id)
    const operation = [...storage.rows.transactionalEmailOutbox!.values()][0]!
    let html = ''
    await createTransactionalEmailWorker(storage.req, {
      suppression: async () => 'cleared',
      crashAfterDelivery: () => {
        html = String(storage.rows.transactionalEmailOutbox!.get(Number(operation.id))!.preparedHtml)
      },
    }).run(String(operation.id))
    const url = [...html.matchAll(/href="([^"]+)"/g)]
      .map((match) => new URL(match[1]!.replaceAll('&amp;', '&')))
      .find((link) => link.pathname === '/auth/callback')!
    return { id, url }
  }
  test.each(['patients', 'platformStaff'] as const)(
    'opens %s recovery with signed ten-minute context without token consumption',
    async (collection) => {
      const { url } = await recovery(collection)
      const response = await GET(new NextRequest(url))
      expect(response.status).toBe(303)
      expect(response.headers.get('location')).toBe(`${origin}/auth/confirm?type=recovery`)
      expect(response.cookies.get('findmydoc_website_recovery')?.value).toMatch(/^[\w-]+\.[\w-]+\.[a-f0-9]{64}$/)
      expect(response.headers.get('set-cookie')).toContain('Max-Age=600')
      expect(response.headers.get('cache-control')).toBe('private, no-store')
      expect(boundary.verify).not.toHaveBeenCalled()
    },
  )
  async function staged(collection: 'patients' | 'platformStaff' = 'patients') {
    const { id, url } = await recovery(collection)
    const response = await GET(new NextRequest(url))
    const cookie = response.cookies.get('findmydoc_website_recovery')!
    const context = readWebsiteRecoveryContext(cookie.value, 'test', [key])!
    return {
      cookie: `${cookie.name}=${cookie.value}`,
      csrf: context.csrf,
      id,
      token: url.searchParams.get('token_hash')!,
    }
  }
  function submit(context: { cookie: string; csrf: string }, extra: { origin?: string; csrf?: string } = {}) {
    return POST(
      new NextRequest(`${origin}/auth/callback?flow=recovery`, {
        method: 'POST',
        headers: { origin: extra.origin ?? origin, 'content-type': 'application/json', cookie: context.cookie },
        body: JSON.stringify({ csrf: extra.csrf ?? context.csrf }),
      }),
    )
  }
  test.each(['patients', 'platformStaff'] as const)(
    'confirms %s once on protected POST and issues completion grant',
    async (collection) => {
      const pending = await staged(collection)
      const response = await submit(pending)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ redirectTo: '/auth/password/reset/complete' })
      const receipt = response.cookies.get('findmydoc_website_recovery')!
      expect(readWebsiteRecoveryContext(receipt.value, 'test', [key])).toMatchObject({
        actionId: pending.id,
        subject,
        flow: collection === 'patients' ? 'patient-recovery' : 'platform-recovery',
        stage: 'confirmed',
      })
      expect(readWebsiteRecoveryContext(receipt.value, 'test', [key])?.tokenHash).toBeUndefined()
      expect(boundary.verify).toHaveBeenCalledWith({ token_hash: pending.token, type: 'recovery' })
      expect(boundary.commit).toHaveBeenCalledOnce()
      expect(storage.rows.authActions!.get(pending.id)).toMatchObject({ state: 'confirmed' })
      expect((await submit(pending)).status).toBe(400)
      expect(boundary.verify).toHaveBeenCalledOnce()
    },
  )
  test.each([{ origin: 'https://attacker.example' }, { csrf: 'wrong' }])(
    'rejects confirmation CSRF %j before provider effects',
    async (extra) => {
      expect((await submit(await staged(), extra)).status).toBe(403)
      expect(boundary.verify).not.toHaveBeenCalled()
      expect(boundary.commit).not.toHaveBeenCalled()
    },
  )
  test.each([
    'expired',
    'revoked',
    'superseded',
    'completed',
    'principal',
    'subject',
    'email',
    'ambiguous',
    'environment',
    'flow',
  ])('shares the safe state for %s authority', async (reason) => {
    const pending = await staged()
    const action = storage.rows.authActions!.get(pending.id)!
    if (['revoked', 'superseded', 'completed'].includes(reason)) action.state = reason
    else if (reason === 'expired') vi.setSystemTime(Date.now() + 600000)
    else if (reason === 'principal') storage.rows.patients!.clear()
    else if (reason === 'subject')
      storage.rows.patients!.get(61)!.supabaseUserId = '25196744-bfa8-4947-b341-93df2879220f'
    else if (reason === 'email') storage.rows.patients!.get(61)!.email = 'changed@example.test'
    else if (reason === 'ambiguous') storage.rows.platformStaff!.set(81, { ...storage.rows.patients!.get(61), id: 81 })
    else if (reason === 'environment') action.environment = 'production'
    else action.actionType = 'clinic-recovery'
    const response = await submit(pending)
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ code: 'INVALID_OR_EXPIRED_LINK' })
    expect(boundary.verify).not.toHaveBeenCalled()
  })
  test('rejects a verified subject mismatch without installing its session', async () => {
    const pending = await staged()
    const { data } = await boundary.getUser()
    boundary.verify.mockResolvedValueOnce({
      data: { session: {}, user: { ...data.user, id: '25196744-bfa8-4947-b341-93df2879220f' } },
      error: null,
    })
    expect((await submit(pending)).status).toBe(400)
    expect(boundary.commit).not.toHaveBeenCalled()
  })
  test('discards a verified session when current authority is revoked during verification', async () => {
    const pending = await staged()
    boundary.verify.mockImplementationOnce(async () => {
      storage.rows.authActions!.get(pending.id)!.state = 'revoked'
      const { data } = await boundary.getUser()
      return { data: { ...data, session: { user: data.user } }, error: null }
    })
    expect((await submit(pending)).status).toBe(400)
    expect(boundary.commit).not.toHaveBeenCalled()
  })
  test('rejects altered or expired grants before a password update', async () => {
    const grant = await confirmed()
    const altered = { ...grant, cookie: `${grant.cookie.slice(0, -1)}${grant.cookie.endsWith('0') ? '1' : '0'}` }
    expect((await finish(altered)).status).toBe(400)
    vi.setSystemTime(Date.now() + 600000)
    expect((await finish(grant)).status).toBe(400)
    expect(boundary.update).not.toHaveBeenCalled()
  })
  test('accepts a grant signed by a retained rotation key without renewing its expiry', async () => {
    const grant = await confirmed()
    const rotated = { version: 'offline-v2', secret: 'offline-only-rotated-recovery-material' } // pragma: allowlist secret
    vi.stubEnv('AUTH_RECOVERY_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [rotated, key] }))
    vi.setSystemTime(Date.now() + 300000)
    boundary.signOut.mockResolvedValueOnce({ error: { status: 503 } })
    const response = await finish(grant)
    expect(response.status).toBe(503)
    const receipt = response.cookies.get('findmydoc_website_recovery')!
    expect(receipt.maxAge).toBe(300)
    expect(readWebsiteRecoveryContext(receipt.value, 'test', [rotated])?.stage).toBe('completed')
  })
  test.each(['origin', 'csrf'] as const)(
    'rejects completion with invalid %s before password effects',
    async (reason) => {
      const grant = await confirmed()
      const response = await completePassword(
        new NextRequest(`${origin}/auth/password/complete`, {
          method: 'POST',
          headers: {
            origin: reason === 'origin' ? 'https://attacker.example' : origin,
            'content-type': 'application/json',
            cookie: grant.cookie,
          },
          body: JSON.stringify({
            csrf: reason === 'csrf' ? 'wrong' : grant.csrf,
            password: 'SyntheticPassword123',
            confirmPassword: 'SyntheticPassword123',
          }),
        }),
      )
      expect(response.status).toBe(403)
      expect(boundary.update).not.toHaveBeenCalled()
    },
  )
  test('retries confirmation after temporary lifecycle failure without another token', async () => {
    const pending = await staged()
    const update = vi.mocked(storage.payload.update)
    const write = update.getMockImplementation()!
    update.mockImplementationOnce(async (options) => {
      if (options.collection === 'authActions' && 'state' in options.data && options.data.state === 'confirmed')
        throw new Error('offline-write-unavailable')
      return write(options)
    })
    const first = await submit(pending)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    const retry = { ...pending, cookie: `${cookie.name}=${cookie.value}` }
    expect((await submit(retry)).status).toBe(200)
    expect(boundary.verify).toHaveBeenCalledOnce()
  })
  test('retries a failed password update with the same completion grant', async () => {
    const grant = await confirmed()
    boundary.update.mockResolvedValueOnce({
      data: { user: null },
      error: { status: 503, message: 'private-provider-detail' },
    })
    const first = await finish(grant)
    expect(first.status).toBe(503)
    expect(await first.json()).toEqual({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' })
    expect(storage.rows.authActions!.get(grant.id)?.state).toBe('confirmed')
    expect(boundary.signOut).not.toHaveBeenCalled()
    expect((await finish(grant)).status).toBe(200)
  })
  test.each(['lifecycle', 'global-sign-out'])(
    'resumes after %s failure without replacing the password again',
    async (reason) => {
      const grant = await confirmed()
      if (reason === 'global-sign-out') boundary.signOut.mockResolvedValueOnce({ error: { status: 503 } })
      else {
        const update = vi.mocked(storage.payload.update)
        const write = update.getMockImplementation()!
        update.mockImplementationOnce(async (options) => {
          if (options.collection === 'authActions' && 'state' in options.data && options.data.state === 'completed')
            throw new Error('offline-write-unavailable')
          return write(options)
        })
      }
      const first = await finish(grant)
      expect(first.status).toBe(503)
      expect(boundary.clear).not.toHaveBeenCalled()
      const cookie = first.cookies.get('findmydoc_website_recovery')!
      expect((await finish({ ...grant, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
      expect(boundary.update).toHaveBeenCalledOnce()
    },
  )
  test('retries only local cleanup after confirmed global sign-out without an authenticated session', async () => {
    const grant = await confirmed()
    boundary.clear.mockRejectedValueOnce(new Error('offline-cookie-write-unavailable'))
    const first = await finish(grant)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    boundary.getUser.mockResolvedValue({ data: { user: null }, error: { status: 400 } })
    expect((await finish({ ...grant, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
    expect(boundary.signOut).toHaveBeenCalledOnce()
    expect(boundary.update).toHaveBeenCalledOnce()
    expect(boundary.clear).toHaveBeenCalledTimes(2)
  })
  async function confirmed(collection: 'patients' | 'platformStaff' = 'patients') {
    const pending = await staged(collection)
    const response = await submit(pending)
    const cookie = response.cookies.get('findmydoc_website_recovery')!
    return { ...pending, cookie: `${cookie.name}=${cookie.value}` }
  }
  function finish(context: { cookie: string; csrf: string }) {
    return completePassword(
      new NextRequest(`${origin}/auth/password/complete`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', cookie: context.cookie },
        body: JSON.stringify({
          csrf: context.csrf,
          password: 'OfflineNewPassword123',
          confirmPassword: 'OfflineNewPassword123',
        }),
      }),
    ) // pragma: allowlist secret
  }
  test.each([
    ['patients', '/login/patient?status=recovery-complete'],
    ['platformStaff', '/admin/login?status=recovery-complete'],
  ] as const)(
    'completes %s with provider password update, global sign-out and fixed finish',
    async (collection, redirectTo) => {
      const grant = await confirmed(collection)
      boundary.update.mockImplementationOnce(async () => {
        expect(storage.rows.authActions!.get(grant.id)?.state).toBe('confirmed')
        return boundary.getUser()
      })
      const response = await finish(grant)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ redirectTo })
      expect(storage.rows.authActions!.get(grant.id)).toMatchObject({ state: 'completed' })
      expect(boundary.update).toHaveBeenCalledWith({ password: 'OfflineNewPassword123' }) // pragma: allowlist secret
      expect(boundary.signOut).toHaveBeenCalledOnce()
      expect(boundary.clear).toHaveBeenCalledOnce()
      expect(response.cookies.get('findmydoc_website_recovery')?.maxAge).toBe(0)
      expect((await finish(grant)).status).toBe(400)
      expect(boundary.update).toHaveBeenCalledOnce()
    },
  )
})
