import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server } from 'node:http'
import { mkdirSync, createWriteStream } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'
import { expect, test } from '@playwright/test'
import { loadLocalAndTestEnv } from '../../../scripts/test-env.mjs'
import { setupTestDatabase, teardownTestDatabase } from '../../../scripts/test-database-harness.mjs'
import { setCookieConsent } from '../helpers/cookieConsent'
import { createBrowserIssueCollector, expectNoBrowserIssues } from '../helpers/browserIssues'

type SyntheticUser = {
  id: string
  email: string
  app_metadata: { user_type: string }
  user_metadata: Record<string, string>
  aud: string
  created_at: string
  email_confirmed_at?: string
}
const users = new Map<string, SyntheticUser>()
const confirmationLinks = new Map<string, string>()
const providerRequests: string[] = []
const appPort = process.env.INQUIRY_BROWSER_PORT ?? '3000'
const origin = `http://localhost:${appPort}`
const artifacts = 'output/playwright/inquiry-existing-account'
let auth: Server
let next: ChildProcess
let clinic: { id: number; slug: string; name: string }
let userToken = ''
const tokenHash = 'b'.repeat(56)
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
    child.stderr.pipe(createWriteStream(`${artifacts}/fixture-runtime.log`, { flags: 'a' }))
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
  loadLocalAndTestEnv()
  for (const key of Object.keys(process.env)) if (key.startsWith('LETTERMINT_')) delete process.env[key]
  Object.assign(process.env, {
    NODE_ENV: 'test',
    VERCEL_ENV: '',
    CI: 'false',
    DATABASE_URI: 'postgresql://postgres:password@localhost:5547/findmydoc-test-inquiry2297-browser', // pragma: allowlist secret
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
  clinic = (await fixtureCommand('create')) as typeof clinic
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
  next = spawn('pnpm', ['dev', '--hostname', 'localhost', '--port', appPort], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development' },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  next.stdout!.pipe(log)
  next.stderr!.pipe(log)
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

function existingUser(email: string, verified = true) {
  users.clear()
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
}

async function prepare(page: import('@playwright/test').Page, email: string) {
  await page.goto(`/clinics/${clinic.slug}`)
  const form = page.getByRole('form', { name: 'Clinic appointment request' })
  await form.getByRole('textbox', { name: 'First Name' }).fill('Entered')
  await form.getByRole('textbox', { name: 'Last Name' }).fill('Details')
  await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000090')
  await form.getByRole('textbox', { name: 'Email' }).fill(email)
  await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
  await form.getByRole('textbox', { name: 'Message' }).fill('Synthetic existing-account browser inquiry.')
  await form.getByRole('checkbox', { name: /process my contact details/ }).check()
  await form.getByRole('checkbox', { name: /authorize creation/ }).check()
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByRole('status')).toContainText('saved but not sent')
  await form.getByRole('link', { name: 'Continue account creation' }).click()
}

test('existing patient keeps inquiry details through sign-in and recovery navigation, then deliberately retries', async ({
  page,
  context,
}) => {
  existingUser('existing-browser@example.test')
  await setCookieConsent(context)
  const issues = createBrowserIssueCollector(page, { ignoredConsoleErrors: [/Failed to load resource.*40[034]/] })
  await page.setViewportSize({ width: 375, height: 812 })
  await prepare(page, 'existing-browser@example.test')
  await page.getByRole('link', { name: 'Sign in here' }).click()
  await expect(page).toHaveURL(/\/login\/patient/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  await expect(page.getByRole('status')).toContainText('saved but not sent')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/auth\/password\/reset/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  await expect(page.getByRole('status')).toContainText('saved but not sent')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${artifacts}/recovery-${width}.png`, fullPage: true })
  }
  await page.getByRole('link', { name: 'Patient sign in' }).click()
  await expect(page).toHaveURL(/\/login\/patient/)
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('existing-browser@example.test')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({ path: `${artifacts}/login-${width}.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 375, height: 400 })
  await page.getByLabel('Password', { exact: true }).fill('WrongSyntheticPassword')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page.getByText('Invalid login credentials', { exact: true })).toBeVisible()
  await page.getByLabel('Password', { exact: true }).focus()
  await page.screenshot({ path: `${artifacts}/login-short-height.png`, fullPage: true })
  await page.setViewportSize({ width: 375, height: 812 })
  await fixtureCommand('pending', clinic.id)
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPatient123')
  await page.getByRole('button', { name: 'Sign in', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/patient\/inquiries$/)
  await expect(page.getByRole('region', { name: 'Unsent inquiries' })).toContainText(clinic.name)
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
  await page.screenshot({ path: `${artifacts}/retry-mobile.png`, fullPage: true })
  await fixtureCommand('approved', clinic.id)
  await page.getByRole('button', { name: 'Try again', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Unsent inquiries' })).toHaveCount(0)
  await expect(page.getByText(clinic.name, { exact: true }).first()).toBeVisible()
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.screenshot({ path: `${artifacts}/submitted-desktop.png`, fullPage: true })
  await page.reload()
  expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(1)
  await expectNoBrowserIssues(issues)
})

test('existing unverified patient confirms on another device and proves their unchanged password before handoff', async ({
  page,
  context,
  browser,
}) => {
  existingUser('unverified-browser@example.test', false)
  const before = ((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs
  await setCookieConsent(context)
  await prepare(page, 'unverified-browser@example.test')
  await page.getByLabel('Password', { exact: true }).fill('IgnoredRegistrationPassword')
  await page.getByLabel('Confirm Password', { exact: true }).fill('IgnoredRegistrationPassword')
  await page.getByRole('button', { name: 'Create Patient Account' }).click()
  await expect(page).toHaveURL(/patient-check-email/)
  await fixtureCommand('worker')
  const link = confirmationLinks.get('unverified-browser@example.test')
  expect(link).toBeTruthy()
  const otherDevice = await browser.newContext({ baseURL: origin, viewport: { width: 375, height: 812 } })
  try {
    await setCookieConsent(otherDevice)
    const other = await otherDevice.newPage()
    const issues = createBrowserIssueCollector(other)
    await other.goto(link!)
    await other.getByRole('button', { name: 'Confirm email', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('link', { name: 'Sign in to send your inquiry' })).toBeVisible()
    await expect(other.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: 900 })
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await other.screenshot({ path: `${artifacts}/password-proof-${width}.png`, fullPage: true })
    }
    await other.getByRole('link', { name: 'Sign in to send your inquiry' }).click()
    await expect(other).toHaveURL(/\/login\/patient/)
    await other.getByLabel('Password', { exact: true }).fill('SyntheticPatient123')
    await other.getByRole('button', { name: 'Sign in', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('region', { name: 'Unsent inquiries' })).toHaveCount(0)
    await expect(other.getByText(clinic.name, { exact: true }).first()).toBeVisible()
    expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(before + 1)
    await expectNoBrowserIssues(issues)
  } finally {
    await otherDevice.close()
  }
})
