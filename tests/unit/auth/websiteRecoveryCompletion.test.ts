import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { createEmailCommandStorage } from '../../helpers/emailCommandStorage'
import { GET, POST } from '@/app/auth/callback/route'
import { readWebsiteRecoveryContext } from '@/auth/actions/websiteRecoveryContext'
import { requestPasswordRecovery } from '@/auth/actions/passwordRecoveryRequests'
import { dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { bindAuthActions } from '@/auth/actions/lifecycle'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { POST as completePassword } from '@/app/auth/password/complete/route'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'

const boundary = vi.hoisted(() => ({
  payload: undefined as unknown as Payload,
  verify: vi.fn(),
  adminUser: vi.fn(),
  adminUpdate: vi.fn(),
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
  createAdminClient: async () => ({
    auth: { admin: { getUserById: boundary.adminUser, updateUserById: boundary.adminUpdate } },
  }),
  createVerificationClient: () => ({ auth: { verifyOtp: boundary.verify }, commitSession: boundary.commit }),
  clearLocalAuthSession: boundary.clear,
  signOutRecoverySession: boundary.signOut,
}))

const key = { version: 'offline-v1', secret: 'offline-only-recovery-completion-material' } // pragma: allowlist secret
const subject = '3525d8e2-0ff0-44cc-9f14-ad8a783a57dd'
const origin = 'https://example.test'
describe('Website recovery at the callback HTTP boundary', () => {
  let storage: ReturnType<typeof createEmailCommandStorage>
  let pool: ReturnType<typeof recoveryPool>
  let providerMetadata: Record<string, unknown>
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-03T12:00:00Z'))
    vi.stubEnv('CI', 'false')
    vi.stubEnv('VERCEL_ENV', '')
    vi.stubEnv('DEPLOYMENT_ENV', 'test')
    vi.stubEnv('AUTH_RECOVERY_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [key] }))
    storage = createEmailCommandStorage()
    pool = recoveryPool()
    Object.assign(storage.payload.db, { pool })
    providerMetadata = {}
    boundary.adminUser.mockReset()
    boundary.adminUpdate.mockReset()
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
      app_metadata: { ...providerMetadata, user_type: collection === 'patients' ? 'patient' : 'platform' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    boundary.adminUser.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.adminUpdate.mockReset().mockImplementation(async (_id, changes) => {
      user.app_metadata = { ...user.app_metadata, ...changes.app_metadata }
      providerMetadata = user.app_metadata
      return { data: { user }, error: null }
    })
    boundary.getUser.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.verify.mockReset().mockResolvedValue({ data: { user, session: { user } }, error: null })
    boundary.update.mockReset().mockResolvedValue({ data: { user }, error: null })
    boundary.signOut.mockReset().mockResolvedValue({ error: null })
    const id = Number([...storage.rows.authActions!.values()].at(-1)!.id)
    const operation = [...storage.rows.transactionalEmailOutbox!.values()].at(-1)!
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
  test('does not repeat a password attempt after an unknown provider result', async () => {
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
    expect((await finish(grant)).status).toBe(503)
    expect(boundary.update).toHaveBeenCalledOnce()
  })
  test('rejects a competing completion before a second password effect and permits the original to finish', async () => {
    const grant = await confirmed()
    let entered!: () => void
    let proceed!: () => void
    const updating = new Promise<void>((resolve) => {
      entered = resolve
    })
    const continueUpdate = new Promise<void>((resolve) => {
      proceed = resolve
    })
    boundary.update.mockImplementationOnce(async () => {
      entered()
      await continueUpdate
      return boundary.getUser()
    })
    const first = finish(grant)
    await updating
    const competing = await finish(grant)
    proceed()
    expect(competing.status).toBe(503)
    expect(await competing.json()).toEqual({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' })
    expect((await first).status).toBe(200)
    expect(boundary.update).toHaveBeenCalledOnce()
    expect((await finish(grant)).status).toBe(400)
  })
  test('keeps provider effects excluded when lock acquisition fails and permits an explicit retry', async () => {
    const grant = await confirmed()
    pool.connect.mockRejectedValueOnce(new Error('private-database-detail'))
    const unavailable = await finish(grant)
    expect(unavailable.status).toBe(503)
    expect(await unavailable.json()).toEqual({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' })
    expect(boundary.update).not.toHaveBeenCalled()
    expect(boundary.signOut).not.toHaveBeenCalled()
    expect((await finish(grant)).status).toBe(200)
  })
  test.each(['error', 'end'])(
    'aborts on connection %s and prevents a late identity result from starting password work',
    async (event) => {
      const grant = await confirmed()
      let entered!: () => void
      let proceed!: () => void
      const reading = new Promise<void>((resolve) => {
        entered = resolve
      })
      const continueRead = new Promise<void>((resolve) => {
        proceed = resolve
      })
      const identity = await boundary.getUser()
      boundary.getUser.mockImplementationOnce(async () => {
        entered()
        await continueRead
        return identity
      })
      const request = finish(grant)
      await reading
      pool.clients[0]!.emit(event, new Error('private-connection-loss'))
      const response = await request
      proceed()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      expect(response.status).toBe(503)
      expect(await response.json()).toEqual({ code: 'RECOVERY_TEMPORARILY_UNAVAILABLE' })
      expect(boundary.update).not.toHaveBeenCalled()
      expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
      expect((await finish(grant)).status).toBe(200)
    },
  )
  test('destroys a connection arriving after the acquisition deadline without invoking the provider', async () => {
    const grant = await confirmed()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    let proceed!: () => void
    let entered!: () => void
    const acquiring = new Promise<void>((resolve) => {
      entered = resolve
    })
    const continueConnect = new Promise<void>((resolve) => {
      proceed = resolve
    })
    const connect = pool.connect.getMockImplementation()!
    pool.connect.mockImplementationOnce(async () => {
      entered()
      await continueConnect
      return connect()
    })
    const request = finish(grant)
    await acquiring
    await vi.advanceTimersByTimeAsync(3000)
    expect((await request).status).toBe(503)
    proceed()
    await vi.advanceTimersByTimeAsync(0)
    expect(boundary.update).not.toHaveBeenCalled()
    expect(pool.clients[0]!.query).not.toHaveBeenCalled()
    expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
  })
  test('bounds a stalled lock statement and destroys its uncertain connection', async () => {
    const grant = await confirmed()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    const connect = pool.connect.getMockImplementation()!
    let entered!: () => void
    const querying = new Promise<void>((resolve) => {
      entered = resolve
    })
    pool.connect.mockImplementationOnce(async () => {
      const client = await connect()
      client.query.mockImplementationOnce(async () => ({ rows: [] }))
      client.query.mockImplementationOnce(() => {
        entered()
        return new Promise<never>(() => {})
      })
      return client
    })
    const request = finish(grant)
    await querying
    await vi.advanceTimersByTimeAsync(1000)
    expect((await request).status).toBe(503)
    expect(boundary.update).not.toHaveBeenCalled()
    expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
  })
  test('bounds stalled provider work and prevents a late success from completing the action', async () => {
    const grant = await confirmed()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    let entered!: () => void
    let proceed!: () => void
    const updating = new Promise<void>((resolve) => {
      entered = resolve
    })
    const continueUpdate = new Promise<void>((resolve) => {
      proceed = resolve
    })
    const result = await boundary.getUser()
    boundary.update.mockImplementationOnce(async () => {
      entered()
      await continueUpdate
      return result
    })
    const request = finish(grant)
    await updating
    await vi.advanceTimersByTimeAsync(30000)
    expect((await request).status).toBe(503)
    proceed()
    await vi.advanceTimersByTimeAsync(0)
    expect(storage.rows.authActions!.get(grant.id)?.state).toBe('confirmed')
    expect(boundary.signOut).not.toHaveBeenCalled()
    expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
  })
  test('preserves the signed cleanup receipt if lock commit fails after global sign-out', async () => {
    const grant = await confirmed()
    const connect = pool.connect.getMockImplementation()!
    pool.connect.mockImplementationOnce(async () => {
      const client = await connect()
      const query = client.query.getMockImplementation()!
      client.query.mockImplementation(async (input) => {
        if (input.text === 'COMMIT') throw new Error('private-commit-uncertainty')
        return query(input)
      })
      return client
    })
    const first = await finish(grant)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    expect(readWebsiteRecoveryContext(cookie.value, 'test', [key])?.stage).toBe('signed-out')
    boundary.getUser.mockResolvedValue({ data: { user: null }, error: { status: 400 } })
    expect((await finish({ ...grant, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
    expect(boundary.update).toHaveBeenCalledOnce()
    expect(boundary.signOut).toHaveBeenCalledOnce()
    expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
  })
  test('destroys a connection whose rollback fails without replaying provider work', async () => {
    const grant = await confirmed()
    const connect = pool.connect.getMockImplementation()!
    pool.connect.mockImplementationOnce(async () => {
      const client = await connect()
      const query = client.query.getMockImplementation()!
      client.query.mockImplementation(async (input) => {
        if (input.text === 'ROLLBACK') throw new Error('private-rollback-detail')
        return query(input)
      })
      return client
    })
    boundary.update.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } })
    expect((await finish(grant)).status).toBe(503)
    expect(boundary.update).toHaveBeenCalledOnce()
    expect(boundary.signOut).not.toHaveBeenCalled()
    expect(pool.clients[0]!.release).toHaveBeenCalledExactlyOnceWith(true)
    expect((await finish(grant)).status).toBe(503)
    expect(boundary.update).toHaveBeenCalledOnce()
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
  test('a copied confirmed grant cannot replace a known successful password after lifecycle failure', async () => {
    const grant = await confirmed()
    const update = vi.mocked(storage.payload.update)
    const write = update.getMockImplementation()!
    update.mockImplementationOnce(async (options) => {
      if (options.collection === 'authActions' && 'state' in options.data && options.data.state === 'completed')
        throw new Error('offline-write-unavailable')
      return write(options)
    })
    expect((await finish(grant)).status).toBe(503)
    const copied = await finish(grant, 'AnotherOfflinePassword123')
    expect(copied.status).toBe(200)
    expect(boundary.update).toHaveBeenCalledExactlyOnceWith({ password: 'OfflineNewPassword123' }) // pragma: allowlist secret
  })
  test.each(['weak_password', 'same_password'])(
    'corrects a definitive %s rejection with a new signed attempt and no expiry renewal',
    async (code) => {
      const grant = await confirmed()
      boundary.update.mockResolvedValueOnce({ data: { user: null }, error: { status: 422, code } })
      const rejected = await finish(grant)
      expect(rejected.status).toBe(422)
      const cookie = rejected.cookies.get('findmydoc_website_recovery')!
      const next = readWebsiteRecoveryContext(cookie.value, 'test', [key])!
      expect(next.progressAttempt).toBe(1)
      expect(next.expiresAt).toBe(readWebsiteRecoveryContext(grant.cookie.split('=')[1], 'test', [key])!.expiresAt)
      expect((await finish(grant, 'AnotherOfflinePassword123')).status).toBe(400)
      expect(
        (await finish({ ...grant, cookie: `${cookie.name}=${cookie.value}` }, 'AnotherOfflinePassword123')).status,
      ).toBe(200)
      expect(boundary.update).toHaveBeenCalledTimes(2)
    },
  )
  test('an uncertain ready reset never upgrades a copied older attempt', async () => {
    const grant = await confirmed()
    const write = boundary.adminUpdate.getMockImplementation()!
    boundary.adminUpdate.mockImplementation(async (id, changes) => {
      const marker = Object.values(changes.app_metadata)[0] as { state: string; attempt: number }
      const result = await write(id, changes)
      return marker.state === 'ready' && marker.attempt === 1
        ? { data: { user: null }, error: { status: 503 } }
        : result
    })
    boundary.update.mockResolvedValueOnce({ data: { user: null }, error: { status: 422, code: 'weak_password' } })
    expect((await finish(grant)).status).toBe(503)
    expect((await finish(grant, 'AnotherOfflinePassword123')).status).toBe(400)
    expect((await submit(grant)).status).toBe(400)
    expect(boundary.update).toHaveBeenCalledOnce()
  })
  test('preserves a known-success receipt when progress persistence fails and blocks the copied original', async () => {
    const grant = await confirmed()
    const write = boundary.adminUpdate.getMockImplementation()!
    let fail = true
    boundary.adminUpdate.mockImplementation(async (id, changes) => {
      const marker = Object.values(changes.app_metadata)[0] as { state: string }
      if (marker.state === 'password-updated' && fail) {
        fail = false
        return { data: { user: null }, error: { status: 503 } }
      }
      return write(id, changes)
    })
    const first = await finish(grant)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    expect(readWebsiteRecoveryContext(cookie.value, 'test', [key])?.stage).toBe('password-updated')
    expect((await finish(grant, 'AnotherOfflinePassword123')).status).toBe(503)
    expect((await finish({ ...grant, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
    expect(boundary.update).toHaveBeenCalledOnce()
  })
  test('requires fresh persisted started progress rather than an admin PUT success object', async () => {
    const grant = await confirmed()
    boundary.adminUpdate.mockImplementationOnce(async () => boundary.adminUser())
    expect((await finish(grant)).status).toBe(503)
    expect(boundary.update).not.toHaveBeenCalled()
  })
  test('retains unrelated provider metadata and writes only the reserved progress key', async () => {
    const grant = await confirmed()
    const {
      data: { user },
    } = await boundary.adminUser()
    user.app_metadata.billing_flag = 'existing-value'
    user.app_metadata.role = 'existing-role'
    expect((await finish(grant)).status).toBe(200)
    expect(user.app_metadata).toMatchObject({
      user_type: 'patient',
      role: 'existing-role',
      billing_flag: 'existing-value',
    })
    for (const [, changes] of boundary.adminUpdate.mock.calls) {
      expect(Object.keys(changes)).toEqual(['app_metadata'])
      expect(Object.keys(changes.app_metadata)).toEqual(['findmydoc_recovery_progress_v1_test'])
      expect(Object.keys(changes.app_metadata.findmydoc_recovery_progress_v1_test).sort()).toEqual([
        'attempt',
        'expiresAt',
        'operation',
        'state',
      ])
    }
  })
  test.each(['missing', 'foreign'])(
    'rejects %s progress rather than reinitializing a copied confirmed grant',
    async (reason) => {
      const grant = await confirmed()
      const {
        data: { user },
      } = await boundary.adminUser()
      if (reason === 'missing') delete user.app_metadata.findmydoc_recovery_progress_v1_test
      else user.app_metadata.findmydoc_recovery_progress_v1_test.operation = 'f'.repeat(64)
      expect((await finish(grant)).status).toBe(400)
      expect((await submit(grant)).status).toBe(400)
      expect(boundary.update).not.toHaveBeenCalled()
    },
  )
  test('a newer confirmed recovery revokes older grants before replacing the bounded marker', async () => {
    const older = await confirmed()
    vi.setSystemTime(Date.now() + 300000)
    const newer = await confirmed()
    expect(storage.rows.authActions!.get(older.id)?.state).toBe('revoked')
    expect((await finish(older)).status).toBe(400)
    expect(boundary.update).not.toHaveBeenCalled()
    expect((await finish(newer)).status).toBe(200)
    expect(boundary.update).toHaveBeenCalledOnce()
  })
  test.each([300000, 600001])(
    'a newer action cannot overwrite an uncertain started attempt after %i milliseconds',
    async (elapsed) => {
      const older = await confirmed()
      boundary.update.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } })
      expect((await finish(older)).status).toBe(503)
      vi.setSystemTime(Date.now() + elapsed)
      const newer = await staged()
      expect((await submit(newer)).status).toBe(503)
      expect(boundary.verify).not.toHaveBeenCalled()
      expect(boundary.adminUpdate).not.toHaveBeenCalled()
      expect(boundary.update).not.toHaveBeenCalled()
    },
  )
  test.each(['initialization', 'definitive-rejection-reset'] as const)(
    'a delayed %s PUT cannot upgrade an old grant after guard loss and a newer flow',
    async (phase) => {
      const original = phase === 'initialization' ? await staged() : await confirmed()
      if (phase === 'definitive-rejection-reset') vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
      const write = boundary.adminUpdate.getMockImplementation()!
      let entered!: () => void
      let proceed!: () => void
      const writing = new Promise<void>((resolve) => {
        entered = resolve
      })
      const continueWrite = new Promise<void>((resolve) => {
        proceed = resolve
      })
      boundary.adminUpdate.mockImplementation(async (id, changes) => {
        const marker = Object.values(changes.app_metadata)[0] as { state: string; attempt: number }
        if (marker.state === 'ready' && marker.attempt === (phase === 'initialization' ? 0 : 1)) {
          entered()
          await continueWrite
          const result = await write(id, changes)
          const current = await boundary.adminUser()
          current.data.user.app_metadata = { ...current.data.user.app_metadata, ...changes.app_metadata }
          return result
        }
        return write(id, changes)
      })
      if (phase === 'definitive-rejection-reset')
        boundary.update.mockResolvedValueOnce({ data: { user: null }, error: { status: 422, code: 'weak_password' } })
      const request = phase === 'initialization' ? submit(original) : finish(original)
      await writing
      if (phase === 'initialization') pool.clients.at(-1)!.emit('error', new Error('offline-guard-loss'))
      else await vi.advanceTimersByTimeAsync(30000)
      const lost = await request
      expect(lost.status).toBe(503)
      const receipt = lost.cookies.get('findmydoc_website_recovery')!
      const copied = receipt ? { ...original, cookie: `${receipt.name}=${receipt.value}` } : original
      expect((await submit(copied)).status).toBe(503)
      vi.setSystemTime(Date.now() + 600001)
      await bindAuthActions(storage.req, { environment: 'test', recoveryKeys: [key] }).sweep()
      const newer = await staged()
      expect((await submit(newer)).status).toBe(503)
      expect(boundary.adminUpdate).not.toHaveBeenCalled()
      proceed()
      if (phase === 'initialization') await new Promise<void>((resolve) => setTimeout(resolve, 0))
      else await vi.advanceTimersByTimeAsync(0)
      expect((await finish(copied)).status).toBe(400)
      expect(boundary.update).not.toHaveBeenCalled()
      expect(storage.rows.authActions!.get(original.id)?.state).toBe('confirmed')
    },
  )
  test.each(['started', 'password-updated'] as const)(
    'a delayed %s PUT after guard loss cannot authorize a newer password writer',
    async (phase) => {
      const original = await confirmed()
      const write = boundary.adminUpdate.getMockImplementation()!
      let entered!: () => void
      let proceed!: () => void
      const writing = new Promise<void>((resolve) => {
        entered = resolve
      })
      const continueWrite = new Promise<void>((resolve) => {
        proceed = resolve
      })
      boundary.adminUpdate.mockImplementation(async (id, changes) => {
        const marker = Object.values(changes.app_metadata)[0] as { state: string }
        if (marker.state === phase) {
          entered()
          await continueWrite
          const result = await write(id, changes)
          const current = await boundary.adminUser()
          current.data.user.app_metadata = { ...current.data.user.app_metadata, ...changes.app_metadata }
          return result
        }
        return write(id, changes)
      })
      const request = finish(original)
      await writing
      pool.clients.at(-1)!.emit('end')
      const first = await request
      expect(first.status).toBe(503)
      expect(boundary.update).toHaveBeenCalledTimes(phase === 'started' ? 0 : 1)
      vi.setSystemTime(Date.now() + 300000)
      const newer = await staged()
      const confirmation = await submit(newer)
      expect(confirmation.status).toBe(phase === 'started' ? 200 : 503)
      proceed()
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
      if (phase === 'started') {
        const cookie = confirmation.cookies.get('findmydoc_website_recovery')!
        expect((await finish({ ...newer, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(400)
        vi.setSystemTime(Date.now() + 600001)
        await bindAuthActions(storage.req, { environment: 'test', recoveryKeys: [key] }).sweep()
        expect(storage.rows.authActions!.get(newer.id)?.state).toBe('confirmed')
        const third = await staged()
        expect((await submit(third)).status).toBe(503)
        expect(boundary.adminUpdate).not.toHaveBeenCalled()
      } else {
        expect((await submit(newer)).status).toBe(503)
        const cookie = first.cookies.get('findmydoc_website_recovery')!
        expect((await finish({ ...original, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
      }
      expect(boundary.update).not.toHaveBeenCalled()
    },
  )
  test('does not repeat an uncertain confirmation marker initialization', async () => {
    const pending = await staged()
    boundary.adminUpdate.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } })
    const first = await submit(pending)
    expect(first.status).toBe(503)
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    const retry = { ...pending, cookie: `${cookie.name}=${cookie.value}` }
    expect(readWebsiteRecoveryContext(cookie.value, 'test', [key])).toMatchObject({
      progressReady: false,
      progressInitializing: true,
    })
    expect((await submit(retry)).status).toBe(503)
    expect(boundary.adminUpdate).toHaveBeenCalledOnce()
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect((await finish(retry)).status).toBe(400)
  })
  test('reconciles a committed confirmation claim whose commit acknowledgement was lost before any provider write', async () => {
    const pending = await staged()
    const commit = storage.payload.db.commitTransaction.bind(storage.payload.db)
    let lost = false
    vi.spyOn(storage.payload.db, 'commitTransaction').mockImplementation(async (transaction) => {
      const claimed = storage.rows.authActions!.get(pending.id)?.state === 'confirmed'
      await commit(transaction)
      if (claimed && !lost && boundary.adminUpdate.mock.calls.length === 0) {
        lost = true
        throw new Error('offline-commit-acknowledgement-lost')
      }
    })
    const response = await submit(pending)
    expect(lost).toBe(true)
    expect(response.status).toBe(200)
    const cookie = response.cookies.get('findmydoc_website_recovery')!
    const grant = { ...pending, cookie: `${cookie.name}=${cookie.value}` }
    expect((await submit(grant)).status).toBe(200)
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect(boundary.adminUpdate).toHaveBeenCalledOnce()
    expect(boundary.update).not.toHaveBeenCalled()
    expect((await finish(grant)).status).toBe(200)
    expect(boundary.update).toHaveBeenCalledOnce()
  })
  test('retries a rolled-back confirmation claim through the same token-free grant without initializing twice', async () => {
    const pending = await staged()
    const commit = storage.payload.db.commitTransaction.bind(storage.payload.db)
    let failed = false
    vi.spyOn(storage.payload.db, 'commitTransaction').mockImplementation(async (transaction) => {
      if (storage.rows.authActions!.get(pending.id)?.state === 'confirmed' && !failed) {
        failed = true
        throw new Error('offline-claim-commit-failed')
      }
      await commit(transaction)
    })
    const first = await submit(pending)
    expect(first.status).toBe(503)
    expect(storage.rows.authActions!.get(pending.id)?.state).toBe('active')
    expect(boundary.adminUpdate).not.toHaveBeenCalled()
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    expect((await submit({ ...pending, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(200)
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect(boundary.adminUpdate).toHaveBeenCalledOnce()
  })
  test('never reconstructs an initialization owner after simultaneous claim acknowledgement and guard loss', async () => {
    const pending = await staged()
    const commit = storage.payload.db.commitTransaction.bind(storage.payload.db)
    let lost = false
    vi.spyOn(storage.payload.db, 'commitTransaction').mockImplementation(async (transaction) => {
      const claimed = storage.rows.authActions!.get(pending.id)?.state === 'confirmed'
      await commit(transaction)
      if (claimed && !lost && boundary.adminUpdate.mock.calls.length === 0) {
        lost = true
        pool.clients.at(-1)!.emit('end')
        throw new Error('offline-commit-acknowledgement-lost')
      }
    })
    const first = await submit(pending)
    expect(first.status).toBe(503)
    expect(storage.rows.authActions!.get(pending.id)?.state).toBe('confirmed')
    const cookie = first.cookies.get('findmydoc_website_recovery')!
    expect((await submit({ ...pending, cookie: `${cookie.name}=${cookie.value}` })).status).toBe(503)
    expect(boundary.verify).toHaveBeenCalledOnce()
    expect(boundary.adminUpdate).not.toHaveBeenCalled()
    expect(boundary.update).not.toHaveBeenCalled()
  })
  test.each([300000, 600001])(
    'an unresolved initialization claim blocks a newer flow after %i milliseconds and sweep',
    async (elapsed) => {
      const pending = await staged()
      boundary.adminUpdate.mockResolvedValueOnce({ data: { user: null }, error: { status: 503 } })
      expect((await submit(pending)).status).toBe(503)
      vi.setSystemTime(Date.now() + elapsed)
      await bindAuthActions(storage.req, { environment: 'test', recoveryKeys: [key] }).sweep()
      expect(storage.rows.authActions!.get(pending.id)?.state).toBe('confirmed')
      const newer = await staged()
      expect((await submit(newer)).status).toBe(503)
      expect(boundary.adminUpdate).not.toHaveBeenCalled()
      expect(boundary.update).not.toHaveBeenCalled()
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
    pool.clients.length = 0
    return { ...pending, cookie: `${cookie.name}=${cookie.value}` }
  }
  function finish(context: { cookie: string; csrf: string }, password = 'OfflineNewPassword123') {
    return completePassword(
      new NextRequest(`${origin}/auth/password/complete`, {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json', cookie: context.cookie },
        body: JSON.stringify({
          csrf: context.csrf,
          password,
          confirmPassword: password,
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

/** Synthetic database boundary; it cannot establish native PostgreSQL scheduling. */
function recoveryPool() {
  const locks = new Set<string>()
  const clients: ReturnType<typeof recoveryConnection>[] = []
  return {
    connect: vi.fn(async () => {
      const connection = recoveryConnection(locks)
      clients.push(connection)
      return connection
    }),
    clients,
  }
}
function recoveryConnection(locks: Set<string>) {
  const events = new EventEmitter()
  const held = new Set<string>()
  const connection = Object.assign(events, {
    query: vi.fn(async (query: { text: string; values?: unknown[] }) => {
      if (query.text === 'BEGIN') return { rows: [] }
      if (query.text === 'SELECT pg_try_advisory_xact_lock($1::bigint) AS acquired') {
        const key = String(query.values?.[0])
        if (locks.has(key) && !held.has(key)) return { rows: [{ acquired: false }] }
        locks.add(key)
        held.add(key)
        return { rows: [{ acquired: true }] }
      }
      if (query.text === 'COMMIT' || query.text === 'ROLLBACK') {
        for (const key of held) locks.delete(key)
        held.clear()
        return { rows: [] }
      }
      throw new Error('Unexpected SQL at the synthetic boundary')
    }),
    release: vi.fn((destroy?: boolean) => {
      if (destroy) for (const key of held) locks.delete(key)
    }),
  })
  return connection
}
