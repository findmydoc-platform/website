import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'
import { createHash, createHmac, randomUUID } from 'node:crypto'
import config from '@payload-config'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { POST as login } from '@/app/api/auth/login/route'
import { POST as register } from '@/app/api/auth/register/patient/route'
import { POST as resend } from '@/app/api/auth/register/patient/resend/route'
import { GET as openConfirmation, POST as confirm } from '@/app/auth/callback/route'
import { readPatientVerificationContext } from '@/auth/actions/patientVerificationContext'
import { requestPasswordRecovery } from '@/auth/actions/passwordRecoveryRequests'
import { dashboardRecoveryContext } from '@/auth/actions/recoveryContext'
import { readWebsiteRecoveryContext } from '@/auth/actions/websiteRecoveryContext'
import { POST as completePassword } from '@/app/auth/password/complete/route'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'

const provider = vi.hoisted(() => ({
  user: null as User | null,
  session: false,
  password: 'SyntheticPatient123', // pragma: allowlist secret
  callback: '',
  passwordWrites: 0,
})) // pragma: allowlist secret
vi.mock('@/auth/utilities/supaBaseServer', () => ({
  createClient: async () => ({
    auth: {
      getUser: async (token?: string) => ({
        data: { user: token === 'existing-patient' || provider.session ? provider.user : null },
        error: null,
      }),
      signInWithPassword: async (input: { password: string }) => {
        if (input.password !== provider.password)
          return { data: { user: null, session: null }, error: { message: 'Invalid login credentials' } }
        provider.session = true
        return { data: { user: provider.user, session: { access_token: 'existing-patient' } }, error: null }
      },
      signOut: async () => {
        provider.session = false
        return { error: null }
      },
      getSession: async () => ({ data: { session: { access_token: 'existing-patient' } }, error: null }),
      updateUser: async (input: { password: string }) => {
        provider.passwordWrites++
        provider.password = input.password
        return { data: { user: provider.user }, error: null }
      },
    },
  }),
  createAdminClient: async () => ({
    auth: {
      admin: {
        createUser: async () => ({ data: { user: null }, error: { status: 422 } }),
        listUsers: async () => ({ data: { users: [provider.user] }, error: null }),
        generateLink: async (input: { type: string; options: { redirectTo: string } }) => {
          provider.callback = input.options.redirectTo
          return {
            data: { user: provider.user, properties: { verification_type: input.type, hashed_token: 'a'.repeat(56) } },
            error: null,
          }
        },
        getUserById: async () => ({ data: { user: provider.user }, error: null }),
        updateUserById: async (_id: string, input: { app_metadata: Record<string, unknown> }) => {
          provider.user = { ...provider.user!, app_metadata: { ...provider.user!.app_metadata, ...input.app_metadata } }
          return { data: { user: provider.user }, error: null }
        },
      },
    },
  }),
  createVerificationClient: () => ({
    auth: {
      verifyOtp: async () => {
        provider.user = { ...provider.user!, email_confirmed_at: new Date().toISOString() }
        return { data: { user: provider.user, session: { access_token: 'existing-patient' } }, error: null }
      },
    },
    commitSession: async () => {
      provider.session = true
    },
  }),
  signOutRecoverySession: async () => {
    provider.session = false
    return { error: null }
  },
  clearLocalAuthSession: async () => {},
}))

const origin = 'https://existing-preparation.test'
const request = (path: string, body?: unknown, cookie?: string, token?: string) =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, origin), {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: origin,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  })
const signIn = (cookie?: string, password = 'SyntheticPatient123', extra: Record<string, unknown> = {}) =>
  login(
    new NextRequest(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
      body: JSON.stringify({ email: provider.user!.email, password, allowedUserTypes: ['patient'], ...extra }),
    }),
  )

describe('existing account inquiry continuation HTTP boundary', () => {
  let payload: Payload
  let clinicId: number
  let doctorId: number | string
  beforeEach(() => {
    // Verification and recovery fixtures use test-scoped keys and the local fake mail runtime.
    vi.stubEnv('CI', 'false')
    vi.stubEnv(
      'AUTH_VERIFICATION_CORRELATION_KEYS_JSON',
      JSON.stringify({
        environment: 'test',
        keys: [{ version: 'integration-v1', secret: 'synthetic-inquiry-verification-key-for-tests' }], // pragma: allowlist secret
      }),
    ) // pragma: allowlist secret
    vi.stubEnv(
      'AUTH_RECOVERY_CORRELATION_KEYS_JSON',
      JSON.stringify({
        environment: 'test',
        keys: [{ version: 'existing-v1', secret: 'synthetic-existing-recovery-key-long-enough' }], // pragma: allowlist secret
      }),
    ) // pragma: allowlist secret
  })
  afterEach(() => {
    vi.unstubAllEnvs()
  })
  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })).docs[0]!
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix: testSlug('existing-preparation') })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
    provider.user = {
      id: crypto.randomUUID(),
      email: 'existing-preparation@example.test',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { user_type: 'patient' },
      user_metadata: { first_name: 'Current', last_name: 'Account' },
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
  })
  afterAll(async () => {
    await payload?.destroy()
  })

  async function openAccountMail(type: 'magiclink' | 'recovery') {
    provider.callback = ''
    const worker = createTransactionalEmailWorker(await createLocalReq({}, payload), {
      suppression: async () => 'cleared',
      delivery: {
        deliver: async (message) => {
          const callback = [...message.html.matchAll(/href="([^"]+)"/g)]
            .map((match) => new URL(match[1]!.replaceAll('&amp;', '&')))
            .find((url) => url.pathname === '/auth/callback')
          if (callback) provider.callback = callback.toString()
          return { type: 'accepted', messageId: `synthetic-${message.providerIdempotencyKey}` }
        },
      },
    })
    for (const candidate of await worker.candidatesForBatch(0)) await worker.run(String(candidate))
    expect(provider.callback).toBeTruthy()
    const callback = new URL(provider.callback)
    expect(callback.searchParams.get('type')).toBe(type)
    return openConfirmation(new NextRequest(`${origin}${callback.pathname}${callback.search}`))
  }
  async function prepare(attempt: string, cookie?: string) {
    provider.session = false
    const response = await request(
      '/api/patient/inquiry-preparations',
      {
        clinicId: String(clinicId),
        doctorId: String(doctorId),
        idempotencyKey: attempt,
        firstName: 'Entered',
        lastName: 'Details',
        email: provider.user!.email,
        phoneNumber: '+493000000097',
        message: 'Synthetic existing-account inquiry.',
        consent: true,
        accountAuthorization: true,
      },
      cookie,
    )
    expect(response.status).toBe(201)
    return { receipt: await response.json(), cookie: response.headers.get('set-cookie')!.split(';')[0]! }
  }

  it('uses password sign-in to send only the originating preparation once with current account details', async () => {
    const own = await prepare('existing-origin')
    const unrelated = await prepare('same-email-unrelated-origin')
    expect(
      (await request('/api/patient/inquiry-preparations/submit', { reference: own.receipt.reference }, own.cookie))
        .status,
    ).toBe(401)
    expect((await signIn()).status).toBe(200)
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: own.receipt.reference },
          own.cookie,
          'existing-patient',
        )
      ).status,
    ).toBe(403)
    const owner = provider.user!
    provider.user = { ...owner, id: randomUUID(), email: 'wrong-account@example.test' }
    expect((await signIn(own.cookie)).status).toBe(200)
    expect(
      await (await request('/api/patient/inquiry-preparations', undefined, own.cookie, 'existing-patient')).json(),
    ).toMatchObject({ preparations: [] })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: own.receipt.reference },
          own.cookie,
          'existing-patient',
        )
      ).status,
    ).toBe(403)
    provider.user = owner
    const signedIn = await signIn(own.cookie)
    expect(signedIn.status).toBe(200)
    expect(await signedIn.json()).toMatchObject({ success: true, redirectUrl: '/patient/inquiries' })
    const submitted = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: own.receipt.reference },
      own.cookie,
      'existing-patient',
    )
    expect(submitted.status).toBe(200)
    const result = await submitted.json()
    expect(result).toMatchObject({ status: 'submitted', expiresAt: own.receipt.expiresAt })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: unrelated.receipt.reference, patientId: String(owner.id), authActionId: 1, subject: owner.id },
          unrelated.cookie,
          'existing-patient',
        )
      ).status,
    ).toBe(400)
    const snapshot = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: result.inquiryId,
      depth: 0,
      overrideAccess: true,
    })
    expect(snapshot).toMatchObject({
      fullName: 'Current Account',
      email: provider.user!.email,
      phoneNumber: '+493000000097',
    })
    const account = (
      await payload.find({
        collection: 'patients',
        where: { supabaseUserId: { equals: provider.user!.id } },
        overrideAccess: true,
      })
    ).docs[0]!
    expect(account.phoneNumber).toBe('+493000000097')
    const replay = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: own.receipt.reference },
      own.cookie,
      'existing-patient',
    )
    expect(await replay.json()).toMatchObject({ status: 'submitted', inquiryId: result.inquiryId })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: unrelated.receipt.reference },
          unrelated.cookie,
          'existing-patient',
        )
      ).status,
    ).toBe(403)
    const listed = await request('/api/patient/inquiries', undefined, own.cookie, 'existing-patient')
    expect(listed.status).toBe(200)
    expect(await listed.json()).toMatchObject({ items: [expect.objectContaining({ id: result.inquiryId })] })
  })

  it('continues a fresh verification action on another device without treating email confirmation as password proof', async () => {
    provider.user = {
      ...provider.user!,
      id: crypto.randomUUID(),
      email: 'existing-unconfirmed@example.test',
      email_confirmed_at: undefined,
    }
    const own = await prepare('existing-unconfirmed-origin')
    const unrelated = await prepare('unrelated-before-existing-action')
    const registered = await register(
      new Request(`${origin}/api/auth/register/patient`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: own.cookie },
        body: JSON.stringify({
          email: provider.user.email,
          password: 'NeverReplaceExistingPassword',
          firstName: 'Entered',
          lastName: 'Details',
        }), // pragma: allowlist secret
      }),
    )
    expect(registered.status).toBe(200)
    expect(
      (
        await register(
          new Request(`${origin}/api/auth/register/patient`, {
            method: 'POST',
            headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: unrelated.cookie },
            body: JSON.stringify({
              email: provider.user.email,
              password: 'NeverReplaceExistingPassword',
              firstName: 'Unrelated',
              lastName: 'Origin',
            }), // pragma: allowlist secret
          }),
        )
      ).status,
    ).toBe(200)
    const opened = await openAccountMail('magiclink')
    const pending = opened.cookies.get('findmydoc_patient_verification')!
    const context = readPatientVerificationContext(pending.value, 'test', [
      { version: 'integration-v1', secret: 'synthetic-inquiry-verification-key-for-tests' },
    ])! // pragma: allowlist secret
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
      .find((value) => value.startsWith('findmydoc_inquiry_preparations='))
      ?.split(';')[0]
    expect(restored).toBeTruthy()
    expect(
      await (
        await request('/api/patient/inquiry-preparations', undefined, unrelated.cookie, 'existing-patient')
      ).json(),
    ).toMatchObject({ preparations: [] })
    expect(
      await (await request('/api/patient/inquiry-preparations', undefined, restored, 'existing-patient')).json(),
    ).toMatchObject({ preparations: [{ status: 'sign-in-required', expiresAt: own.receipt.expiresAt }] })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: own.receipt.reference },
          restored,
          'existing-patient',
        )
      ).status,
    ).toBe(403)
    expect((await signIn(restored, 'NeverReplaceExistingPassword')).status).toBe(401)
    expect((await signIn(restored)).status).toBe(200)
    const submitted = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: own.receipt.reference },
      restored,
      'existing-patient',
    )
    expect(submitted.status).toBe(200)
    expect(await submitted.json()).toMatchObject({ status: 'submitted', expiresAt: own.receipt.expiresAt })
  })

  it('restores a fresh recovery context on another device, then requires password sign-in without repeating recovery after handoff failure', async () => {
    provider.user = { ...provider.user!, id: randomUUID(), email: 'existing-recovery@example.test' }
    const own = await prepare('existing-recovery-origin')
    await payload.create({
      collection: 'patients',
      data: {
        supabaseUserId: provider.user.id,
        email: provider.user.email!,
        firstName: 'Recovery',
        lastName: 'Patient',
      },
      context: { skipSupabaseUserCreation: true },
      overrideAccess: true,
    })
    const key = { version: 'existing-v1', secret: 'synthetic-existing-recovery-key-long-enough' } // pragma: allowlist secret
    const timestamp = new Date().toISOString()
    const requestId = randomUUID()
    const body = JSON.stringify({ email: provider.user.email, clientIP: '198.51.100.9' })
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
    const req = await createLocalReq({}, payload)
    req.headers = new Headers({ Cookie: own.cookie })
    // Local Website recovery admission intentionally stays disabled; use its existing signed admission command.
    await requestPasswordRecovery(req, { email: provider.user.email!, context })
    const opened = await openAccountMail('recovery')
    const pending = opened.cookies.get('findmydoc_website_recovery')!
    const grant = readWebsiteRecoveryContext(pending.value, 'test', [key])!
    const confirmed = await confirm(
      new NextRequest(`${origin}/auth/callback?flow=recovery`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${pending.name}=${pending.value}` },
        body: JSON.stringify({ csrf: grant.csrf }),
      }),
    )
    expect(confirmed.status).toBe(200)
    const completion = confirmed.cookies.get('findmydoc_website_recovery')!
    provider.passwordWrites = 0
    const hooks = payload.collections.inquiryPreparations.config.hooks
    const original = hooks.beforeChange
    hooks.beforeChange = [
      ...(original ?? []),
      ({ data }) => {
        if (data.patient) throw new Error('Synthetic preparation binding unavailable')
      },
    ]
    let finish: Awaited<ReturnType<typeof completePassword>>
    try {
      finish = await completePassword(
        new NextRequest(`${origin}/auth/password/complete`, {
          method: 'POST',
          headers: {
            Origin: origin,
            'Content-Type': 'application/json',
            Cookie: `${completion.name}=${completion.value}`,
          },
          body: JSON.stringify({
            csrf: grant.csrf,
            password: 'RecoveredPatient123',
            confirmPassword: 'RecoveredPatient123',
          }),
        }),
      ) // pragma: allowlist secret
      expect(finish.status).toBe(200)
      expect(await finish.json()).toEqual({
        redirectTo: '/login/patient?status=recovery-complete',
        inquiryContinuationPending: true,
      })
      const retained = finish.cookies.get('findmydoc_website_recovery')!
      expect(readWebsiteRecoveryContext(retained.value, 'test', [key])).toMatchObject({ stage: 'signed-out' })
      hooks.beforeChange = original
      finish = await completePassword(
        new NextRequest(`${origin}/auth/password/complete`, {
          method: 'POST',
          headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: `${retained.name}=${retained.value}` },
          body: JSON.stringify({ csrf: grant.csrf }),
        }),
      )
      expect(finish.status).toBe(200)
      expect(await finish.json()).toEqual({ redirectTo: '/login/patient?status=recovery-complete' })
      expect(provider.passwordWrites).toBe(1)
    } finally {
      hooks.beforeChange = original
    }
    const restored = finish.headers
      .getSetCookie()
      .find((value) => value.startsWith('findmydoc_inquiry_preparations='))
      ?.split(';')[0]
    expect(restored).toBeTruthy()
    expect((await signIn(restored)).status).toBe(401)
    expect((await signIn(restored, 'RecoveredPatient123')).status).toBe(200)
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'pending' }, overrideAccess: true })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: own.receipt.reference },
          restored,
          'existing-patient',
        )
      ).status,
    ).toBeGreaterThanOrEqual(400)
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
    const submitted = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: own.receipt.reference, retry: true },
      restored,
      'existing-patient',
    )
    expect(submitted.status).toBe(200)
    expect(await submitted.json()).toMatchObject({ status: 'submitted', expiresAt: own.receipt.expiresAt })
    expect((await signIn(restored, 'RecoveredPatient123')).status).toBe(200)
  })

  it('uses eligible resend to carry a new origin through an existing unverified account without claiming its older action', async () => {
    provider.user = {
      id: randomUUID(),
      email: 'existing-old-action@example.test',
      app_metadata: { user_type: 'patient' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    provider.password = 'SyntheticPatient123' // pragma: allowlist secret
    const registrationBody = {
      email: provider.user.email,
      password: 'NeverReplaceExistingPassword',
      firstName: 'Existing',
      lastName: 'Patient',
    } // pragma: allowlist secret
    const registrationRequest = (cookie?: string) =>
      new Request(`${origin}/api/auth/register/patient`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
        body: JSON.stringify(registrationBody),
      })
    expect((await register(registrationRequest())).status).toBe(200)
    const own = await prepare('new-origin-old-account-action')
    expect((await register(registrationRequest(own.cookie))).status).toBe(200)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(Date.now() + 300001)
    try {
      expect(
        (
          await resend(
            new Request(`${origin}/api/auth/register/patient/resend`, {
              method: 'POST',
              headers: { Origin: origin, 'Content-Type': 'application/json', Cookie: own.cookie },
              body: JSON.stringify({ email: provider.user.email }),
            }),
          )
        ).status,
      ).toBe(200)
      const opened = await openAccountMail('magiclink')
      const pending = opened.cookies.get('findmydoc_patient_verification')!
      const context = readPatientVerificationContext(pending.value, 'test', [
        { version: 'integration-v1', secret: 'synthetic-inquiry-verification-key-for-tests' },
      ])! // pragma: allowlist secret
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
        .find((value) => value.startsWith('findmydoc_inquiry_preparations='))
        ?.split(';')[0]
      expect(restored).toBeTruthy()
      expect(
        await (await request('/api/patient/inquiry-preparations', undefined, restored, 'existing-patient')).json(),
      ).toMatchObject({
        preparations: [
          { reference: own.receipt.reference, status: 'sign-in-required', expiresAt: own.receipt.expiresAt },
        ],
      })
      expect((await signIn(restored)).status).toBe(200)
      expect(
        (
          await request(
            '/api/patient/inquiry-preparations/submit',
            { reference: own.receipt.reference },
            restored,
            'existing-patient',
          )
        ).status,
      ).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not revive an expired preparation when the existing patient signs in successfully', async () => {
    const own = await prepare('expired-existing-password-signin')
    const before = (
      await payload.count({
        collection: 'patientClinicInquiries',
        where: { clinic: { equals: clinicId } },
        overrideAccess: true,
      })
    ).totalDocs
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(own.receipt.expiresAt))
    try {
      expect((await signIn(own.cookie)).status).toBe(200)
      expect(
        await (await request('/api/patient/inquiry-preparations', undefined, own.cookie, 'existing-patient')).json(),
      ).toMatchObject({ preparations: [] })
      expect(
        (
          await request(
            '/api/patient/inquiry-preparations/submit',
            { reference: own.receipt.reference, retry: true },
            own.cookie,
            'existing-patient',
          )
        ).status,
      ).toBeGreaterThanOrEqual(400)
      expect(
        (
          await payload.count({
            collection: 'patientClinicInquiries',
            where: { clinic: { equals: clinicId } },
            overrideAccess: true,
          })
        ).totalDocs,
      ).toBe(before)
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps two password-login authorizations independent when one handoff fails and is deliberately retried', async () => {
    provider.user = {
      id: randomUUID(),
      email: 'existing-multiple@example.test',
      email_confirmed_at: new Date().toISOString(),
      app_metadata: { user_type: 'patient' },
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString(),
    }
    provider.password = 'SyntheticPatient123' // pragma: allowlist secret
    const first = await prepare('existing-multiple-first')
    const second = await prepare('existing-multiple-second', first.cookie)
    expect((await signIn(first.cookie)).status).toBe(200)
    const firstResponse = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: first.receipt.reference },
      first.cookie,
      'existing-patient',
    )
    expect(firstResponse.status).toBe(200)
    const submittedFirst = await firstResponse.json()
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'pending' }, overrideAccess: true })
    expect(
      (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: second.receipt.reference },
          first.cookie,
          'existing-patient',
        )
      ).status,
    ).toBeGreaterThanOrEqual(400)
    await payload.update({ collection: 'clinics', id: clinicId, data: { status: 'approved' }, overrideAccess: true })
    expect(
      await (await request('/api/patient/inquiry-preparations', undefined, first.cookie, 'existing-patient')).json(),
    ).toMatchObject({
      preparations: [
        { reference: first.receipt.reference, status: 'submitted', inquiryId: submittedFirst.inquiryId },
        { reference: second.receipt.reference, status: 'try-again', expiresAt: second.receipt.expiresAt },
      ],
    })
    expect(
      await (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: second.receipt.reference },
          first.cookie,
          'existing-patient',
        )
      ).json(),
    ).toMatchObject({ status: 'try-again' })
    expect((await request('/api/patient/inquiries', undefined, first.cookie, 'existing-patient')).status).toBe(200)
    const retry = await request(
      '/api/patient/inquiry-preparations/submit',
      { reference: second.receipt.reference, retry: true },
      first.cookie,
      'existing-patient',
    )
    expect(retry.status).toBe(200)
    expect(await retry.json()).toMatchObject({ status: 'submitted', expiresAt: second.receipt.expiresAt })
    expect(
      await (
        await request(
          '/api/patient/inquiry-preparations/submit',
          { reference: first.receipt.reference, retry: true },
          first.cookie,
          'existing-patient',
        )
      ).json(),
    ).toMatchObject({ status: 'submitted', inquiryId: submittedFirst.inquiryId })
    const list = await (await request('/api/patient/inquiries', undefined, first.cookie, 'existing-patient')).json()
    expect(list.items).toHaveLength(2)
  })
})
