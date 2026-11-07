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
const origin = 'http://localhost:3000'
const artifacts = 'output/playwright/inquiry-preparation'
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
    DATABASE_URI: 'postgresql://postgres:password@localhost:5433/findmydoc-test-preparation-browser', // pragma: allowlist secret
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
      if (request.method === 'POST' && url.pathname === '/auth/v1/admin/users') {
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
  next = spawn('pnpm', ['dev', '--hostname', 'localhost', '--port', '3000'], {
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

test('prepares, registers, confirms on another device and deliberately retries through My inquiries', async ({
  page,
  browser,
  context,
}) => {
  const issues = createBrowserIssueCollector(page)
  await setCookieConsent(context)
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto(`/clinics/${clinic.slug}`)
  const form = page.getByRole('form', { name: 'Clinic appointment request' })
  await form.getByRole('textbox', { name: 'First Name' }).fill('Synthetic')
  await form.getByRole('textbox', { name: 'Last Name' }).fill('Patient')
  await form.getByRole('textbox', { name: 'Phone Number' }).fill('+493000000090')
  await form.getByRole('textbox', { name: 'Email' }).fill('preparation-browser@example.test')
  await form.getByRole('combobox', { name: 'Doctor', exact: true }).selectOption({ index: 1 })
  await form.getByRole('textbox', { name: 'Message' }).fill('Synthetic inquiry for browser verification.')
  await form.getByRole('checkbox', { name: /process my contact details/ }).check()
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByText('Authorize account creation and this inquiry submission.')).toBeVisible()
  await form.getByRole('checkbox', { name: /authorize creation/ }).focus()
  await page.keyboard.press('Space')
  await form.getByRole('button', { name: 'Save inquiry and create account' }).click()
  await expect(form.getByRole('status')).toContainText('saved but not sent')
  await expect(form.getByRole('status')).toContainText('seven days')
  for (const width of [320, 375, 640, 768, 1024]) {
    await page.setViewportSize({ width, height: width < 640 ? 812 : 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await form.getByRole('status').screenshot({ path: `${artifacts}/saved-${width}.png` })
  }
  await form.getByRole('link', { name: 'Continue account creation' }).click()
  await expect(page).toHaveURL(/\/register\/patient\?inquiry=/)
  await expect(page.getByLabel('First Name', { exact: true })).toHaveValue('Synthetic')
  await page.reload()
  await expect(page.getByPlaceholder('patient@example.com')).toHaveValue('preparation-browser@example.test')
  await page.getByLabel('Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  await page.getByLabel('Confirm Password', { exact: true }).fill('SyntheticPatient123') // pragma: allowlist secret
  const registration = page.waitForResponse((response) => response.url().endsWith('/api/auth/register/patient'))
  await page.getByRole('button', { name: 'Create Patient Account' }).click()
  expect((await registration).status(), JSON.stringify(providerRequests)).toBe(200)
  await expect(page).toHaveURL(/patient-check-email/)
  await fixtureCommand('worker')
  const link = confirmationLinks.get('preparation-browser@example.test')
  expect(link, JSON.stringify(providerRequests)).toBeTruthy()
  expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(0)
  await fixtureCommand('pending', clinic.id)
  const otherDevice = await browser.newContext({ baseURL: origin, viewport: { width: 1024, height: 900 } })
  try {
    await setCookieConsent(otherDevice)
    const other = await otherDevice.newPage()
    const otherIssues = createBrowserIssueCollector(other, {
      ignoredConsoleErrors: [/Failed to load resource.*40[034]/],
    })
    await other.goto(link!)
    await expect(other.getByRole('heading', { name: 'Verify your email' })).toBeVisible()
    await other.getByRole('button', { name: 'Confirm email', exact: true }).click()
    await expect(other).toHaveURL(/\/patient\/inquiries$/)
    await expect(other.getByRole('region', { name: 'Unsent inquiries' })).toContainText('saved but not sent')
    for (const width of [320, 375, 640, 768, 1024]) {
      await other.setViewportSize({ width, height: width < 640 ? 812 : 900 })
      await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
      expect(await other.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      await other.screenshot({ path: `${artifacts}/retry-${width}.png`, fullPage: true })
    }
    await other.setViewportSize({ width: 375, height: 400 })
    await other.getByRole('button', { name: 'Try again', exact: true }).scrollIntoViewIfNeeded()
    await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await other.screenshot({ path: `${artifacts}/retry-short-height.png`, fullPage: true })
    await other.setViewportSize({ width: 1024, height: 900 })
    await other.reload()
    await expect(other.getByRole('button', { name: 'Try again', exact: true })).toBeVisible()
    await other.getByRole('button', { name: 'Try again', exact: true }).click()
    await expect(other.getByRole('region', { name: 'Unsent inquiries' }).getByRole('alert')).toContainText(
      'Your account is ready, but the inquiry was not sent.',
    )
    await fixtureCommand('approved', clinic.id)
    await other.getByRole('button', { name: 'Try again', exact: true }).focus()
    await other.keyboard.press('Enter')
    await expect(other.getByRole('region', { name: 'Unsent inquiries' })).toHaveCount(0)
    await expect(other.getByText(clinic.name, { exact: true }).first()).toBeVisible()
    await other.screenshot({ path: `${artifacts}/submitted-desktop.png`, fullPage: true })
    await other.reload()
    expect(((await fixtureCommand('count', clinic.id)) as { totalDocs: number }).totalDocs).toBe(1)
    await expectNoBrowserIssues(otherIssues)
  } finally {
    await otherDevice.close()
  }
  await expectNoBrowserIssues(issues)
})
