import { activateClinicNotificationsForTest } from '@/features/clinicNotifications/service'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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
import { GET as scheduledCleanup } from '@/app/api/internal/transactional-email/worker/route'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { withPreparationStorage } from '@/features/inquiryPreparations/context'

const provider = vi.hoisted(() => ({
  user: null as User | null,
  session: false,
  create: true,
  callback: '',
  verifications: 0,
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
        generateLink: async (input: { type: string; options: { redirectTo: string } }) => {
          provider.callback = input.options.redirectTo
          return {
            data: { user: provider.user, properties: { verification_type: input.type, hashed_token: 'a'.repeat(56) } },
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
        provider.verifications++
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

describe('authorized inquiry preparation HTTP boundary', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number | string
  beforeEach(() => {
    // Verification and recovery fixtures use test-scoped keys and the local fake mail runtime.
    vi.stubEnv('CI', 'false')
    vi.stubEnv('AUTH_VERIFICATION_CORRELATION_KEYS_JSON', JSON.stringify({ environment: 'test', keys: [key] }))
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    await activateClinicNotificationsForTest(await createLocalReq({}, payload))
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: testSlug('inquiryPreparations') })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
  })
  afterAll(async () => {
    await payload?.destroy()
  })
  async function openVerificationMail(token: string) {
    provider.callback = ''
    const worker = createTransactionalEmailWorker(await createLocalReq({}, payload), {
      suppression: async () => 'cleared',
    })
    for (const candidate of await worker.candidatesForBatch(0)) await worker.run(String(candidate))
    expect(provider.callback).toBeTruthy()
    const callback = new URL(provider.callback)
    callback.searchParams.set('type', 'magiclink')
    callback.searchParams.set('token_hash', token.repeat(56))
    return openConfirmation(new NextRequest(`${origin}${callback.pathname}${callback.search}`))
  }
  it('saves an authorized inquiry privately without delivering it to the clinic', async () => {
    const response = await request('/api/patient/inquiry-preparations', {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      idempotencyKey: 'synthetic-prepare-1',
      firstName: 'Synthetic',
      lastName: 'Patient',
      email: 'synthetic-patient@example.test',
      phoneNumber: '+493000000099',
      message: 'Synthetic private inquiry.',
      consent: true,
      accountAuthorization: true,
    })
    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const saved = await response.json()
    expect(saved).toMatchObject({ status: 'saved-not-sent' })
    expect(saved).not.toHaveProperty('inquiryId')
    expect(Date.parse(saved.expiresAt) - Date.parse(saved.authorizedAt)).toBe(604800000)
    const cookie = response.headers.get('set-cookie')!.split(';')[0]!
    expect(response.headers.get('set-cookie')).toContain('HttpOnly')
    const resumed = await request('/api/patient/inquiry-preparations', undefined, cookie)
    expect(await resumed.json()).toMatchObject({
      preparations: [{ reference: saved.reference, status: 'saved-not-sent' }],
    })
    const clinicInquiries = await payload.find({
      collection: 'patientClinicInquiries',
      where: { clinic: { equals: clinicId } },
      overrideAccess: true,
    })
    expect(clinicInquiries.totalDocs).toBe(0)
    expect(
      (
        await payload.count({
          collection: 'clinicNotificationOccurrences',
          where: { clinic: { equals: clinicId } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(0)
    await expect(payload.find({ collection: 'inquiryPreparations', overrideAccess: true })).rejects.toMatchObject({
      status: 403,
    })
    const raw = await request('/api/inquiryPreparations')
    expect(raw.status).toBeGreaterThanOrEqual(400)
    const foreign = await request('/api/patient/inquiry-preparations')
    expect(await foreign.json()).toMatchObject({ preparations: [] })
  })
  it('resumes a new patient on another device and sends once through the normal patient inquiry flow', async () => {
    provider.session = false
    const prepared = await request('/api/patient/inquiry-preparations', {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      idempotencyKey: 'synthetic-activation',
      firstName: 'Account',
      lastName: 'Patient',
      email: 'synthetic-activation@example.test',
      phoneNumber: '+493000000098',
      message: 'Synthetic activation inquiry.',
      consent: true,
      accountAuthorization: true,
    })
    const saved = await prepared.json()
    const untrustedPreparation = await request('/api/patient/inquiry-preparations', {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      idempotencyKey: 'synthetic-email-only',
      firstName: 'Untrusted',
      lastName: 'Origin',
      email: 'synthetic-activation@example.test',
      phoneNumber: '+493000000097',
      message: 'Synthetic inquiry from an unrelated origin context.',
      consent: true,
      accountAuthorization: true,
    })
    const untrusted = await untrustedPreparation.json()
    const untrustedCookie = untrustedPreparation.headers.get('set-cookie')!.split(';')[0]!
    const originalCookie = prepared.headers.get('set-cookie')!.split(';')[0]!
    expect(
      (
        await register(
          new Request(`${origin}/api/auth/register/patient`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: originalCookie },
            body: JSON.stringify({
              email: 'synthetic-activation@example.test',
              password: 'SyntheticPatient123', // pragma: allowlist secret
              firstName: 'Account',
              lastName: 'Patient',
            }),
          }),
        )
      ).status,
    ).toBe(200) // pragma: allowlist secret
    // The real mail outbox exposes no content before confirmation; action diagnostics remain private.
    const opened = await openVerificationMail('a')
    const pending = opened.cookies.get('findmydoc_patient_verification')!
    const context = readPatientVerificationContext(pending.value, 'test', [key])!
    expect(context).toBeTruthy()
    provider.verifications = 0
    const hooks = payload.collections.inquiryPreparations.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ...(original ?? []),
      ({ data }) => {
        if (data.patient) throw new Error('Synthetic preparation binding unavailable')
      },
    ]
    let activated: Awaited<ReturnType<typeof confirm>>
    try {
      activated = await confirm(
        new NextRequest(`${origin}/auth/callback`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${pending.name}=${pending.value}` },
          body: JSON.stringify({ csrf: context.csrf }),
        }),
      )
      expect(activated.status).toBe(200)
      expect(await activated.json()).toEqual({ redirectTo: '/patient/inquiries', inquiryContinuationPending: true })
      const retained = activated.cookies.get('findmydoc_patient_verification')!
      expect(readPatientVerificationContext(retained.value, 'test', [key])).toMatchObject({ stage: 'confirmed' })
      hooks.beforeChange = original
      activated = await confirm(
        new NextRequest(`${origin}/auth/callback`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${retained.name}=${retained.value}` },
          body: JSON.stringify({ csrf: context.csrf }),
        }),
      )
      expect(activated.status).toBe(200)
      expect(provider.verifications).toBe(1)
    } finally {
      hooks.beforeChange = original
    }
    const crossDeviceCookie = activated.headers
      .getSetCookie()
      .find((value) => value.startsWith('findmydoc_inquiry_preparations='))!
      .split(';')[0]!
    const resumed = await request(
      '/api/patient/inquiry-preparations',
      undefined,
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(await resumed.json()).toMatchObject({
      preparations: [{ reference: saved.reference, status: 'saved-not-sent' }],
    })
    expect(
      await (
        await request('/api/patient/inquiry-preparations', undefined, untrustedCookie, 'synthetic-patient')
      ).json(),
    ).toMatchObject({ preparations: [] })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: untrusted.reference },
          untrustedCookie,
          'synthetic-patient',
        )
      ).status,
    ).toBe(403)
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: saved.reference, patientId: 'forged' },
          crossDeviceCookie,
          'synthetic-patient',
        )
      ).status,
    ).toBe(400)
    const owner = provider.user!
    provider.user = { ...owner, id: crypto.randomUUID(), email: 'synthetic-foreign@example.test' }
    expect(
      await (
        await request('/api/patient/inquiry-preparations', undefined, crossDeviceCookie, 'synthetic-patient')
      ).json(),
    ).toMatchObject({ preparations: [] })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: saved.reference },
          crossDeviceCookie,
          'synthetic-patient',
        )
      ).status,
    ).toBe(403)
    provider.user = owner
    const verifiedAt = provider.user!.email_confirmed_at
    provider.user!.email_confirmed_at = undefined
    const unverified = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: saved.reference },
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(unverified.status).toBe(403)
    provider.user!.email_confirmed_at = verifiedAt
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'pending' }, overrideAccess: true })
    const failed = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: saved.reference },
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(failed.status).toBeGreaterThanOrEqual(400)
    expect(provider.user!.email_confirmed_at).toBeTruthy()
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
    const noAutomaticRetry = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: saved.reference },
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(await noAutomaticRetry.json()).toMatchObject({ status: 'try-again', expiresAt: saved.expiresAt })
    const attempts = await Promise.all(
      [true, true].map((retry) =>
        request(
          '/api/patient/inquiry-preparations/submit',
          { reference: saved.reference, retry },
          crossDeviceCookie,
          'synthetic-patient',
        ),
      ),
    )
    expect(attempts.map((attempt) => attempt.status)).toEqual([200, 200])
    const submitted = attempts[0]!
    expect(submitted.status).toBe(200)
    const receipt = await submitted.json()
    expect(receipt).toMatchObject({ status: 'submitted', inquiryId: expect.any(String) })
    const replay = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: saved.reference, retry: true },
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(await replay.json()).toMatchObject({ inquiryId: receipt.inquiryId, status: 'submitted' })
    const queue = await request(
      '/api/patient/inquiries?lifecycle=all',
      undefined,
      crossDeviceCookie,
      'synthetic-patient',
    )
    expect(await queue.json()).toMatchObject({ items: [expect.objectContaining({ id: receipt.inquiryId })] })
  })

  it('does not authorize a reconciled identity with uncertain password setup through email verification alone', async () => {
    provider.session = false
    provider.create = false
    provider.user = {
      id: crypto.randomUUID(),
      email: 'synthetic-uncertain@example.test',
      app_metadata: { user_type: 'patient' },
      user_metadata: { first_name: 'Uncertain', last_name: 'Patient' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    try {
      const prepared = await request('/api/patient/inquiry-preparations', {
        clinicId: String(clinicId),
        doctorId: String(doctorId),
        idempotencyKey: 'synthetic-uncertain',
        firstName: 'Uncertain',
        lastName: 'Patient',
        email: 'synthetic-uncertain@example.test',
        phoneNumber: '+493000000095',
        message: 'Synthetic uncertain account inquiry.',
        consent: true,
        accountAuthorization: true,
      })
      const saved = await prepared.json()
      const cookie = prepared.headers.get('set-cookie')!.split(';')[0]!
      expect(
        (
          await register(
            new Request(`${origin}/api/auth/register/patient`, {
              method: 'POST',
              headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
              body: JSON.stringify({
                email: 'synthetic-uncertain@example.test',
                password: 'SyntheticPatient123', // pragma: allowlist secret
                firstName: 'Uncertain',
                lastName: 'Patient',
              }),
            }),
          )
        ).status,
      ).toBe(200) // pragma: allowlist secret
      const opened = await openVerificationMail('c')
      const pending = opened.cookies.get('findmydoc_patient_verification')!
      const context = readPatientVerificationContext(pending.value, 'test', [key])!
      const activated = await confirm(
        new NextRequest(`${origin}/auth/callback`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${pending.name}=${pending.value}` },
          body: JSON.stringify({ csrf: context.csrf }),
        }),
      )
      expect(activated.status).toBe(200)
      expect(
        activated.headers.getSetCookie().some((value) => value.startsWith('findmydoc_inquiry_preparations=')),
      ).toBe(true)
      expect(
        await (await request('/api/patient/inquiry-preparations', undefined, cookie, 'synthetic-patient')).json(),
      ).toMatchObject({ preparations: [{ reference: saved.reference, status: 'sign-in-required' }] })
      expect(
        (
          await request(
            '/api/patient/inquiry-preparations/submit',
            { reference: saved.reference },
            cookie,
            'synthetic-patient',
          )
        ).status,
      ).toBe(403)
    } finally {
      provider.create = true
    }
  })

  it('replaces an expired confirmation through the existing resend flow without extending inquiry authorization', async () => {
    provider.session = false
    const prepared = await request('/api/patient/inquiry-preparations', {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      idempotencyKey: 'synthetic-resend',
      firstName: 'Resend',
      lastName: 'Patient',
      email: 'synthetic-resend@example.test',
      phoneNumber: '+493000000094',
      message: 'Synthetic retained inquiry after expired confirmation.',
      consent: true,
      accountAuthorization: true,
    })
    const saved = await prepared.json()
    const cookie = prepared.headers.get('set-cookie')!.split(';')[0]!
    expect(
      (
        await register(
          new Request(`${origin}/api/auth/register/patient`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
            body: JSON.stringify({
              email: 'synthetic-resend@example.test',
              password: 'SyntheticPatient123', // pragma: allowlist secret
              firstName: 'Resend',
              lastName: 'Patient',
            }),
          }),
        )
      ).status,
    ).toBe(200) // pragma: allowlist secret
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(Date.now() + 86400001))
    try {
      expect(
        (
          await resend(
            new Request(`${origin}/api/auth/register/patient/resend`, {
              method: 'POST',
              headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: cookie },
              body: JSON.stringify({ email: 'synthetic-resend@example.test' }),
            }),
          )
        ).status,
      ).toBe(200)
      const opened = await openVerificationMail('d')
      const pending = opened.cookies.get('findmydoc_patient_verification')!
      const context = readPatientVerificationContext(pending.value, 'test', [key])!
      const activated = await confirm(
        new NextRequest(`${origin}/auth/callback`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${pending.name}=${pending.value}` },
          body: JSON.stringify({ csrf: context.csrf }),
        }),
      )
      expect(activated.status).toBe(200)
      const restored = activated.headers
        .getSetCookie()
        .find((value) => value.startsWith('findmydoc_inquiry_preparations='))!
        .split(';')[0]!
      expect(
        await (await request('/api/patient/inquiry-preparations', undefined, restored, 'synthetic-patient')).json(),
      ).toMatchObject({
        preparations: [{ reference: saved.reference, expiresAt: saved.expiresAt, status: 'saved-not-sent' }],
      })
      const submitted = await request(
        '/api/patient/inquiry-preparations/submit',
        { reference: saved.reference },
        restored,
        'synthetic-patient',
      )
      expect(submitted.status).toBe(200)
      expect(await submitted.json()).toMatchObject({ status: 'submitted', expiresAt: saved.expiresAt })
    } finally {
      vi.useRealTimers()
    }
  })

  it('deletes expired preparations through bounded scheduler cleanup without changing the completed account or inquiry', async () => {
    provider.session = false
    const prepared = await request('/api/patient/inquiry-preparations', {
      clinicId: String(clinicId),
      doctorId: String(doctorId),
      idempotencyKey: 'synthetic-expiry',
      firstName: 'Expired',
      lastName: 'Patient',
      email: 'synthetic-expiry@example.test',
      phoneNumber: '+493000000096',
      message: 'Synthetic expiring inquiry.',
      consent: true,
      accountAuthorization: true,
    })
    const saved = await prepared.json()
    expect(prepared.status).toBe(201)
    const account = provider.user!
    const inquiryCount = (await payload.count({ collection: 'patientClinicInquiries', overrideAccess: true })).totalDocs
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(saved.expiresAt))
    try {
      vi.stubEnv('CRON_SECRET', 'synthetic-preparation-cleanup-secret-for-tests-only') // pragma: allowlist secret
      const req = await createLocalReq({}, payload)
      const expiredCount = async () =>
        withPreparationStorage(req, () =>
          payload.count({
            collection: 'inquiryPreparations',
            req,
            overrideAccess: true,
            where: { expiresAt: { less_than_equal: new Date().toISOString() } },
          }),
        )
      const before = (await expiredCount()).totalDocs
      expect(before).toBeGreaterThan(0)
      // Only the authenticated scheduler may remove these records. A filtered public read cannot prove deletion.
      for (let batch = 0; batch < 10 && (await expiredCount()).totalDocs > 0; batch++) {
        const count = (await expiredCount()).totalDocs
        const scheduled = await scheduledCleanup(
          new Request(`${origin}/api/internal/transactional-email/worker`, {
            headers: { Authorization: 'Bearer synthetic-preparation-cleanup-secret-for-tests-only' },
          }),
        )
        // Hosted mail and recovery are inactive; preparation cleanup must still run.
        expect(scheduled.status).toBe(503)
        const removed = count - (await expiredCount()).totalDocs
        expect(removed).toBeGreaterThan(0)
        expect(removed).toBeLessThanOrEqual(100)
      }
      expect((await expiredCount()).totalDocs).toBe(0)
      expect(
        await withPreparationStorage(req, () =>
          payload.count({
            collection: 'inquiryPreparations',
            req,
            overrideAccess: true,
            where: { reference: { equals: saved.reference } },
          }),
        ),
      ).toMatchObject({ totalDocs: 0 })
      expect((await payload.count({ collection: 'patientClinicInquiries', overrideAccess: true })).totalDocs).toBe(
        inquiryCount,
      )
      const patients = await payload.find({
        collection: 'patients',
        where: { supabaseUserId: { equals: account.id } },
        overrideAccess: true,
      })
      expect(patients.totalDocs).toBe(1)
      const cookie = prepared.headers.get('set-cookie')!.split(';')[0]!
      expect(await (await request('/api/patient/inquiry-preparations', undefined, cookie)).json()).toMatchObject({
        preparations: [],
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
