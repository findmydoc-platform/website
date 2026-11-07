import { activateClinicNotificationsForTest } from '@/features/clinicNotifications/service'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { POST as resend } from '@/app/api/auth/register/patient/resend/route'
import { POST as register } from '@/app/api/auth/register/patient/route'
import { GET as openConfirmation, POST as confirm } from '@/app/auth/callback/route'
import { readPatientVerificationContext } from '@/auth/actions/patientVerificationContext'
import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import config from '@payload-config'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import type { PreparationReceipt } from '@/features/inquiryPreparations/contracts'
import { runInquiryPreparationCleanup } from '@/features/inquiryPreparations/cleanup'

const provider = vi.hoisted(() => ({ user: null as User | null, session: false, create: true, callback: '' }))
vi.mock('next/server.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server.js')>()),
  after: (task: () => Promise<unknown> | unknown) => {
    void task()
  },
}))
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: async () => ({
    auth: {
      getUser: async (token?: string) => ({
        data: { user: token === 'synthetic-patient' || provider.session ? provider.user : null },
        error: null,
      }),
    },
  }),
  createAdminClient: async () => ({
    auth: {
      admin: {
        createUser: async (input: { email: string; user_metadata: Record<string, string> }) => {
          if (!provider.create) return { data: { user: null }, error: { status: 422 } }
          provider.user = {
            id: crypto.randomUUID(),
            email: input.email,
            app_metadata: { user_type: 'patient' },
            user_metadata: input.user_metadata,
            aud: 'authenticated',
            created_at: new Date().toISOString(),
          }
          return { data: { user: provider.user }, error: null }
        },
        generateLink: async (input: { options: { redirectTo: string } }) => {
          provider.callback = input.options.redirectTo
          return {
            data: { user: provider.user, properties: { verification_type: 'magiclink', hashed_token: 'a'.repeat(56) } },
            error: null,
          }
        },
        getUserById: async () => ({ data: { user: provider.user }, error: null }),
        listUsers: async () => ({ data: { users: provider.user ? [provider.user] : [] }, error: null }),
      },
    },
  }),
  createVerificationClient: () => ({
    auth: {
      verifyOtp: async () => {
        provider.user = { ...provider.user!, email_confirmed_at: new Date().toISOString() }
        return {
          data: {
            user: provider.user,
            session: { user: provider.user, access_token: 'synthetic-patient', refresh_token: 'synthetic-refresh' },
          },
          error: null,
        }
      },
    },
    commitSession: async () => {
      provider.session = true
    },
  }),
}))
const key = { version: 'integration-v1', secret: 'synthetic-inquiry-verification-key-for-tests' } // pragma: allowlist secret
const origin = 'https://preparation.test'
const request = (path: string, body?: unknown, cookie?: string, token?: string) =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, origin), {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  })

describe('multiple individually authorized inquiry HTTP journey', () => {
  let payload: Payload
  let clinicId: number
  const doctors = new Map<number, number | string>()
  beforeAll(async () => {
    vi.stubEnv('AUTH_VERIFICATION_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [key] }))
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    await activateClinicNotificationsForTest(await createLocalReq({}, payload))
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: testSlug('multiple-inquiries') })
    clinicId = fixture.clinic.id
    doctors.set(clinicId, fixture.doctor.id)
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
  })
  afterAll(async () => {
    await payload?.destroy()
  })

  async function prepare(attempt: string, email: string, cookie?: string, destination = clinicId) {
    const response = await request(
      '/api/patient/inquiry-preparations',
      {
        clinicId: String(destination),
        doctorId: String(doctors.get(destination)),
        idempotencyKey: `synthetic-multiple-${attempt}`,
        firstName: 'Synthetic',
        lastName: 'Patient',
        email,
        phoneNumber: '+493000000080',
        message: `Individually authorized ${attempt}.`,
        consent: true,
        accountAuthorization: true,
      },
      cookie,
    )
    expect(response.status).toBe(201)
    return {
      receipt: (await response.json()) as PreparationReceipt,
      cookie: response.headers.get('set-cookie')!.split(';')[0]!,
    }
  }
  async function registerPatient(email: string, cookie: string) {
    provider.session = false
    const response = await register(
      new Request(`${origin}/api/auth/register/patient`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ email, password: 'SyntheticPatient123', firstName: 'Synthetic', lastName: 'Patient' }), // pragma: allowlist secret
      }),
    )
    expect(response.status).toBe(200)
  }
  async function activate() {
    provider.callback = ''
    const worker = createTransactionalEmailWorker(await createLocalReq({}, payload), {
      suppression: async () => 'cleared',
    })
    for (const candidate of await worker.candidatesForBatch(0)) await worker.run(String(candidate))
    expect(provider.callback).toBeTruthy()
    const callback = new URL(provider.callback)
    callback.searchParams.set('type', 'magiclink')
    callback.searchParams.set('token_hash', 'a'.repeat(56))
    const opened = await openConfirmation(new NextRequest(`${origin}${callback.pathname}${callback.search}`))
    const pending = opened.cookies.get('findmydoc_patient_verification')!
    const context = readPatientVerificationContext(pending.value, 'test', [key])!
    const response = await confirm(
      new NextRequest(`${origin}/auth/callback`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${pending.name}=${pending.value}` },
        body: JSON.stringify({ csrf: context.csrf }),
      }),
    )
    expect(response.status).toBe(200)
    return response.headers
      .getSetCookie()
      .find((value) => value.startsWith('findmydoc_inquiry_preparations='))!
      .split(';')[0]!
  }
  async function readAll(cookie: string) {
    const items: PreparationReceipt[] = []
    let cursor: number | null = null
    do {
      const response = await request(
        `/api/patient/inquiry-preparations${cursor ? `?cursor=${cursor}` : ''}`,
        undefined,
        cookie,
        'synthetic-patient',
      )
      expect(response.status).toBe(200)
      const page = (await response.json()) as { preparations: PreparationReceipt[]; nextCursor: number | null }
      expect(page.preparations.length).toBeLessThanOrEqual(25)
      items.push(...page.preparations)
      if (cursor && page.nextCursor) expect(page.nextCursor).toBeGreaterThan(cursor)
      cursor = page.nextCursor
    } while (cursor)
    return items
  }

  it.each([false, true])(
    'retains every authorized inquiry beyond the first page, replacement link %s',
    async (replacement) => {
      provider.session = false
      const email = `multiple-pages-${replacement}@example.test`
      const first = await prepare('pages-0', email)
      const references = [first.receipt.reference]
      for (let index = 1; index < 102; index++)
        references.push((await prepare(`pages-${index}`, email, first.cookie)).receipt.reference)
      await registerPatient(email, first.cookie)
      if (replacement) {
        vi.useFakeTimers({ toFake: ['Date'] })
        vi.setSystemTime(new Date(Date.now() + 86400001))
      }
      try {
        if (replacement) {
          const response = await resend(
            new Request(`${origin}/api/auth/register/patient/resend`, {
              method: 'POST',
              headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: first.cookie },
              body: JSON.stringify({ email }),
            }),
          )
          expect(response.status).toBe(200)
        }
        const cookie = await activate()
        const resumed = await readAll(cookie)
        expect(resumed.map((item) => item.reference)).toEqual(references)
        expect(new Set(resumed.map((item) => item.reference)).size).toBe(102)
        expect(resumed.every((item) => item.status === 'saved-not-sent')).toBe(true)
        expect(resumed[0]?.expiresAt).toBe(first.receipt.expiresAt)
      } finally {
        vi.useRealTimers()
      }
    },
    120_000,
  )

  it('includes another individually authorized inquiry in the proved origin after registration and before confirmation', async () => {
    provider.session = false
    const email = 'multiple-after-registration@example.test'
    const first = await prepare('before-registration', email)
    await registerPatient(email, first.cookie)
    const second = await prepare('after-registration', email, first.cookie)
    const foreign = await prepare('untrusted-after-registration', email)
    const cookie = await activate()
    expect((await readAll(cookie)).map((item) => item.reference)).toEqual([
      first.receipt.reference,
      second.receipt.reference,
    ])
    expect(await readAll(foreign.cookie)).toEqual([])
    for (const item of [first, second]) {
      const sent = await request(
        '/api/patient/inquiry-preparations/submit',
        { reference: item.receipt.reference },
        cookie,
        'synthetic-patient',
      )
      expect(sent.status).toBe(200)
      expect(await sent.json()).toMatchObject({ status: 'submitted', expiresAt: item.receipt.expiresAt })
    }
    const queue = await request('/api/patient/inquiries', undefined, cookie, 'synthetic-patient')
    expect((await queue.json()).items).toHaveLength(2)
  })

  it('isolates successful, failed, expired and replayed inquiries across clinics and concurrent tabs', async () => {
    provider.session = false
    const email = 'multiple-mixed@example.test'
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixtureB = await createClinicFixture(payload, city.id, { slugPrefix: testSlug('multiple-clinic-b') })
    doctors.set(fixtureB.clinic.id, fixtureB.doctor.id)
    await payload.update({
      collection: 'clinics',
      id: fixtureB.clinic.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() - 604800001))
    let expired: Awaited<ReturnType<typeof prepare>>
    try {
      expired = await prepare('expired-independent', email)
    } finally {
      vi.useRealTimers()
    }
    const first = await prepare('clinic-a', email, expired.cookie)
    const second = await prepare('clinic-b', email, first.cookie, fixtureB.clinic.id)
    const independent = await prepare('clinic-a-independent', email, first.cookie)
    const replayed = await prepare('clinic-a', email, first.cookie)
    expect(replayed.receipt.reference).toBe(first.receipt.reference)
    expect(independent.receipt.reference).not.toBe(first.receipt.reference)
    await registerPatient(email, first.cookie)
    const cookie = await activate()
    expect((await readAll(cookie)).map((item) => item.reference)).toEqual([
      first.receipt.reference,
      second.receipt.reference,
      independent.receipt.reference,
    ])
    const send = (item: PreparationReceipt, retry = false) =>
      request(
        '/api/patient/inquiry-preparations/submit',
        { reference: item.reference, retry },
        cookie,
        'synthetic-patient',
      )
    await payload.update({
      collection: 'clinics',
      id: fixtureB.clinic.id,
      data: { status: 'pending' },
      overrideAccess: true,
    })
    const outcomes = await Promise.all([
      send(first.receipt),
      send(first.receipt),
      send(second.receipt),
      send(independent.receipt),
    ])
    expect(outcomes.map((response) => response.status < 400)).toEqual([true, true, false, true])
    const receipts = await readAll(cookie)
    expect(receipts.map((item) => item.status)).toEqual(['submitted', 'try-again', 'submitted'])
    expect(receipts.map((item) => item.expiresAt)).toEqual([
      first.receipt.expiresAt,
      second.receipt.expiresAt,
      independent.receipt.expiresAt,
    ])
    const successful = receipts.filter((item) => item.status === 'submitted').map((item) => item.inquiryId)
    expect(new Set(successful).size).toBe(2)
    expect((await send(expired.receipt, true)).status).toBe(403)
    await payload.update({
      collection: 'clinics',
      id: fixtureB.clinic.id,
      data: { status: 'approved' },
      overrideAccess: true,
    })
    expect(await (await send(second.receipt)).json()).toMatchObject({ status: 'try-again' })
    // Discard the successful acknowledgement as if the browser lost the response.
    expect((await send(second.receipt, true)).status).toBe(200)
    const reconciled = await Promise.all([send(second.receipt, true), send(first.receipt, true)])
    const secondResult = (await reconciled[0]!.json()) as PreparationReceipt
    expect(secondResult).toMatchObject({ status: 'submitted', expiresAt: second.receipt.expiresAt })
    expect(await reconciled[1]!.json()).toMatchObject({ status: 'submitted', inquiryId: successful[0] })
    const queue = await (await request('/api/patient/inquiries', undefined, cookie, 'synthetic-patient')).json()
    expect(queue.items).toHaveLength(3)
    expect(queue.items.map((item: { id: string }) => item.id)).toEqual(
      expect.arrayContaining([...successful, secondResult.inquiryId]),
    )
    for (const item of [first, second, independent]) {
      const receipt = (await readAll(cookie)).find((value) => value.reference === item.receipt.reference)!
      const response = await request(
        `/api/patient/inquiries/detail?inquiryId=${receipt.inquiryId}`,
        undefined,
        cookie,
        'synthetic-patient',
      )
      expect(response.status).toBe(200)
      const detail = await response.json()
      expect(detail.inquiry.originalRequest.message).toBe(
        `Individually authorized ${item === first ? 'clinic-a' : item === second ? 'clinic-b' : 'clinic-a-independent'}.`,
      )
      expect(detail.inquiry.clinic.id).toBe(String(item === second ? fixtureB.clinic.id : clinicId))
      expect(detail.inquiry.binding.conversationId).toEqual(expect.any(String))
    }
    expect(await runInquiryPreparationCleanup(Date.now() + 5000)).toBe(1)
    expect(await runInquiryPreparationCleanup(Date.now() + 5000)).toBe(0)
    expect(
      (await (await request('/api/patient/inquiries', undefined, cookie, 'synthetic-patient')).json()).items,
    ).toHaveLength(3)
  })
})
