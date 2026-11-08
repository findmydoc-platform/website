import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { Transform } from 'node:stream'
import { setTimeout as delay } from 'node:timers/promises'
import { test } from '@playwright/test'
import { loadLocalAndTestEnv } from '../../../scripts/test-env.mjs'
import { setupTestDatabase, teardownTestDatabase } from '../../../scripts/test-database-harness.mjs'

type SyntheticUser = {
  id: string
  email: string
  app_metadata: { user_type: string }
  user_metadata: Record<string, string>
  aud: string
  created_at: string
  email_confirmed_at?: string
}

/** Real Next/Payload journey runtime; only the external identity provider is synthetic. */
export function registerInquiryPreparationRuntime({
  origin,
  artifacts,
  clinicCount = 1,
}: {
  origin: string
  artifacts: string
  clinicCount?: number
}) {
  const users = new Map<string, SyntheticUser>()
  const confirmationLinks = new Map<string, string>()
  const providerRequests: string[] = []
  let auth: Server
  let next: ChildProcess
  const clinics: Array<{ id: number; slug: string; name: string; doctorId: number | string }> = []
  let userToken = ''
  let identityPause: { entered: () => void; released: Promise<void> } | undefined
  const tokenHash = 'b'.repeat(56)
  const sanitizedLog = () =>
    new Transform({
      transform(chunk, _encoding, callback) {
        callback(null, String(chunk).replace(/https?:\/\/(?:localhost|127\.0\.0\.1):\d+/g, 'http://localhost:3000'))
      },
    })
  function tokenFor(user: SyntheticUser) {
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, app_metadata: user.app_metadata, user_metadata: user.user_metadata })}.synthetic`
  }

  async function fixtureCommand(command: string, id?: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'pnpm',
        ['exec', 'tsx', 'scripts/inquiry-preparation-browser-fixture.ts', command, ...(id ? [String(id)] : [])],
        { env: process.env, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      child.stderr.pipe(sanitizedLog()).pipe(createWriteStream(`${artifacts}/fixture-runtime.log`, { flags: 'a' }))
      let output = ''
      child.stdout.on('data', (chunk) => {
        output += String(chunk)
      })
      child.once('error', reject)
      child.once('exit', (code) => {
        if (code !== 0) reject(new Error('Isolated browser fixture failed.'))
        else {
          try {
            resolve(JSON.parse(output.trim().split('\n').at(-1)!))
          } catch {
            reject(new Error('Invalid browser fixture result.'))
          }
        }
      })
    })
  }

  test.beforeAll(async () => {
    test.setTimeout(180_000)
    mkdirSync(artifacts, { recursive: true })
    writeFileSync(`${artifacts}/fixture-runtime.log`, '')
    loadLocalAndTestEnv()
    for (const key of Object.keys(process.env)) if (key.startsWith('LETTERMINT_')) delete process.env[key]
    Object.assign(process.env, {
      NODE_ENV: 'test',
      VERCEL_ENV: '',
      CI: 'false',
      DATABASE_URI: process.env.DATABASE_URI!,
      DEPLOYMENT_ENVIRONMENT: 'test',
      NEXT_PUBLIC_DEPLOYMENT_ENV: 'test',
      PUBLIC_SITE_FALLBACK_MODE: 'full',
      NEXT_PUBLIC_SERVER_URL: origin,
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'synthetic-preparation-anon',
      SUPABASE_SERVICE_ROLE_KEY: 'synthetic-preparation-admin',
      AUTH_VERIFICATION_CORRELATION_KEYS_JSON: JSON.stringify({
        environment: 'test',
        keys: [{ version: 'browser-v1', secret: 'synthetic-preparation-browser-verification-key' }], // pragma: allowlist secret
      }), // pragma: allowlist secret
    })
    await setupTestDatabase({ templateKind: 'baseline' })
    for (let index = 0; index < clinicCount; index++)
      clinics.push((await fixtureCommand('create', index + 1)) as (typeof clinics)[number])
    auth = createServer((request, response) => {
      void (async () => {
        const url = new URL(request.url!, origin)
        providerRequests.push(`${request.method} ${url.pathname}`)
        const chunks: Buffer[] = []
        for await (const chunk of request) chunks.push(Buffer.from(chunk))
        const body = chunks.length ? (JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown>) : {}
        let result: unknown
        if (request.method === 'POST' && url.pathname === '/auth/v1/token') {
          const user = [...users.values()].find((item) => item.email === body.email)
          if (!user?.email_confirmed_at || body.password !== 'SyntheticPatient123') {
            // pragma: allowlist secret
            response.writeHead(400, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ msg: 'Invalid login credentials' }))
            return
          }
          userToken = tokenFor(user)
          result = {
            access_token: userToken,
            refresh_token: 'synthetic-browser-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            user,
          }
        } else if (request.method === 'POST' && url.pathname === '/auth/v1/admin/users') {
          if ([...users.values()].some((item) => item.email === body.email)) {
            response.writeHead(422, { 'Content-Type': 'application/json' })
            response.end(JSON.stringify({ msg: 'User already registered' }))
            return
          }
          const user: SyntheticUser = {
            id: randomUUID(),
            email: String(body.email),
            app_metadata: { user_type: 'patient' },
            user_metadata: body.user_metadata as Record<string, string>,
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          }
          users.set(user.id, user)
          result = user
        } else if (request.method === 'GET' && url.pathname.startsWith('/auth/v1/admin/users/'))
          result = users.get(url.pathname.split('/').at(-1)!)
        else if (request.method === 'GET' && url.pathname === '/auth/v1/admin/users')
          result = { users: [...users.values()], aud: 'authenticated', total: users.size }
        else if (request.method === 'POST' && url.pathname === '/auth/v1/admin/generate_link') {
          const user = [...users.values()].find((item) => item.email === body.email)!
          const link = new URL(String(body.redirect_to ?? url.searchParams.get('redirect_to')))
          link.searchParams.set('token_hash', tokenHash)
          link.searchParams.set('type', 'magiclink')
          confirmationLinks.set(user.email, `${origin}${link.pathname}${link.search}`)
          result = {
            ...user,
            hashed_token: tokenHash,
            verification_type: 'magiclink',
            action_link: link.toString(),
            redirect_to: link.toString(),
            email_otp: '123456',
          }
        } else if (request.method === 'POST' && url.pathname === '/auth/v1/verify') {
          const user = [...users.values()].find((item) => !item.email_confirmed_at)!
          user.email_confirmed_at = new Date().toISOString()
          userToken = tokenFor(user)
          result = {
            access_token: userToken,
            refresh_token: 'synthetic-browser-refresh',
            token_type: 'bearer',
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user,
          }
        } else if (request.method === 'GET' && url.pathname === '/auth/v1/user') {
          const pause = identityPause
          identityPause = undefined
          if (pause) {
            pause.entered()
            await pause.released
          }
          result = [...users.values()].find(
            (item) =>
              request.headers.authorization === `Bearer ${tokenFor(item)}` ||
              request.headers.authorization === `Bearer ${userToken}`,
          )
        }
        response.writeHead(result ? 200 : 401, { 'Content-Type': 'application/json' })
        response.end(JSON.stringify(result ?? { message: 'Invalid synthetic identity' }))
      })().catch(() => {
        response.writeHead(500)
        response.end('{}')
      })
    })
    await new Promise<void>((resolve, reject) => {
      auth.once('error', reject)
      auth.listen(0, 'localhost', resolve)
    })
    const address = auth.address()
    if (!address || typeof address === 'string') throw new Error('Synthetic provider did not bind.')
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://localhost:${address.port}`
    mkdirSync(artifacts, { recursive: true })
    const log = createWriteStream(`${artifacts}/runtime.log`)
    next = spawn('pnpm', ['dev', '--hostname', 'localhost', '--port', new URL(origin).port], {
      cwd: process.cwd(),
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    next.stdout!.pipe(sanitizedLog()).pipe(log)
    next.stderr!.pipe(sanitizedLog()).pipe(log)
    for (let attempt = 0; attempt < 180; attempt++) {
      if (next.exitCode !== null) throw new Error('Isolated Next server exited.')
      try {
        if ((await fetch(`${origin}/register/patient`)).status < 500) return
      } catch {}
      await delay(500)
    }
    throw new Error('Isolated Next server did not become ready.')
  })

  test.afterAll(async () => {
    next?.kill('SIGTERM')
    if (next) await Promise.race([new Promise<void>((resolve) => next.once('exit', () => resolve())), delay(10_000)])
    if (auth) await new Promise<void>((resolve) => auth.close(() => resolve()))
    await teardownTestDatabase()
  })

  return {
    clinics,
    fixtureCommand,
    confirmationLinks,
    providerRequests,
    pauseNextIdentityRead() {
      let entered!: () => void
      let release!: () => void
      const reached = new Promise<void>((resolve) => {
        entered = resolve
      })
      const released = new Promise<void>((resolve) => {
        release = resolve
      })
      identityPause = { entered, released }
      return { reached, release }
    },
    resetIdentities() {
      users.clear()
      userToken = ''
    },
    existingUser(email: string, verified = true) {
      users.clear()
      userToken = ''
      const user: SyntheticUser = {
        id: randomUUID(),
        email,
        app_metadata: { user_type: 'patient' },
        user_metadata: { first_name: 'Current', last_name: 'Patient' },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
        ...(verified ? { email_confirmed_at: new Date().toISOString() } : {}),
      }
      users.set(user.id, user)
    },
  }
}
