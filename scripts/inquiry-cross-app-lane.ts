import { spawn, type ChildProcess } from 'node:child_process'
import http, { type Server } from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { loadLocalAndTestEnv } from './test-env.mjs'
import { setupTestDatabase, teardownTestDatabase } from './test-database-harness.mjs'

loadLocalAndTestEnv()
const authPort = Number(process.env.INQUIRY_ACCEPTANCE_AUTH_PORT ?? '54321')
if (!Number.isSafeInteger(authPort) || authPort < 1 || authPort > 65535)
  throw new Error('Invalid isolated auth stub port')
const websiteOrigin = 'http://127.0.0.1:3200'
const authOrigin = `http://127.0.0.1:${authPort}`
const controlOrigin = 'http://127.0.0.1:3201'
const databaseUri =
  process.env.INQUIRY_ACCEPTANCE_DATABASE_URI ??
  'postgresql://postgres:password@127.0.0.1:5433/findmydoc-test-cross-app' // pragma: allowlist secret
const dashboardDirectory = process.env.INQUIRY_ACCEPTANCE_DASHBOARD_DIR

if (!dashboardDirectory) throw new Error('INQUIRY_ACCEPTANCE_DASHBOARD_DIR is required')
const resolvedDashboardDirectory = path.resolve(dashboardDirectory)
const dashboardPackage = JSON.parse(fs.readFileSync(path.join(resolvedDashboardDirectory, 'package.json'), 'utf8')) as {
  name?: string
}
if (dashboardPackage.name !== 'clinic-dashboard') {
  throw new Error('INQUIRY_ACCEPTANCE_DASHBOARD_DIR must point to the Clinic Dashboard checkout')
}

const subjects = {
  clinic: '00000000-0000-4000-8000-000000000001',
  secondClinic: '00000000-0000-4000-8000-000000000004',
  foreignClinic: '00000000-0000-4000-8000-000000000002',
  patient: '00000000-0000-4000-8000-000000000003',
} as const
const controlToken = 'cross-app-control-token-0001'

function syntheticJwt(subject: string, email: string, type: 'clinic' | 'patient') {
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    app_metadata: { provider: 'email', providers: ['email'], user_type: type },
    aud: 'authenticated',
    email,
    exp: 4_102_444_800,
    iat: 1_787_616_000,
    role: 'authenticated',
    sub: subject,
    user_metadata: {},
  })}.synthetic`
}

const tokens = {
  clinic: syntheticJwt(subjects.clinic, 'clinic-staff@example.com', 'clinic'),
  secondClinic: syntheticJwt(subjects.secondClinic, 'second-clinic-staff@example.com', 'clinic'),
  foreignClinic: syntheticJwt(subjects.foreignClinic, 'foreign-clinic@example.com', 'clinic'),
  patient: syntheticJwt(subjects.patient, 'cross-app-ada@example.com', 'patient'),
} as const

type SyntheticUser = {
  email: string
  firstName: string
  id: string
  lastName: string
  type: 'clinic' | 'patient'
}

function syntheticSupabaseUser(user: SyntheticUser) {
  return {
    app_metadata: { provider: 'email', providers: ['email'], user_type: user.type },
    aud: 'authenticated',
    created_at: '2026-08-25T00:00:00.000Z',
    email: user.email,
    id: user.id,
    role: 'authenticated',
    updated_at: '2026-08-25T00:00:00.000Z',
    user_metadata: { first_name: user.firstName, last_name: user.lastName },
  }
}

function startAuthStub(users: ReadonlyMap<string, SyntheticUser>): Promise<Server> {
  const server = http.createServer((request, response) => {
    const authorization = request.headers.authorization
    const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : ''
    const user = users.get(token)
    if (request.method !== 'GET' || request.url?.split('?')[0] !== '/auth/v1/user' || !user) {
      response.writeHead(401, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ code: 401, message: 'Invalid synthetic token' }))
      return
    }
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify(syntheticSupabaseUser(user)))
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(authPort, '127.0.0.1', () => resolve(server))
  })
}

function startControlServer(
  offboardClinicStaff: () => Promise<void>,
  createNotificationInquiry: () => Promise<unknown>,
  removeNotificationInquiry: () => Promise<void>,
  extraRoutes: Readonly<Record<string, () => Promise<unknown>>> = {},
): Promise<Server> {
  const server = http.createServer((request, response) => {
    if (
      request.method !== 'POST' ||
      ![
        '/offboard-clinic-staff',
        '/create-notification-inquiry',
        '/remove-notification-inquiry',
        ...Object.keys(extraRoutes),
      ].includes(request.url?.split('?')[0] ?? '') ||
      request.headers.authorization !== `Bearer ${controlToken}`
    ) {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'not-found' }))
      return
    }
    const route = request.url?.split('?')[0] ?? ''
    const extra = extraRoutes[route]
    const createsNotification = route === '/create-notification-inquiry'
    void (
      extra
        ? extra()
        : createsNotification
          ? createNotificationInquiry()
          : request.url?.split('?')[0] === '/remove-notification-inquiry'
            ? removeNotificationInquiry()
            : offboardClinicStaff()
    )
      .then((result) => {
        response.writeHead(createsNotification || extra ? 200 : 204, { 'content-type': 'application/json' })
        response.end(createsNotification || extra ? JSON.stringify(result ?? { completed: true }) : undefined)
      })
      .catch(() => {
        response.writeHead(500, { 'content-type': 'application/json' })
        response.end(JSON.stringify({ error: 'control-failed' }))
      })
  })

  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(3201, '127.0.0.1', () => resolve(server))
  })
}

async function waitForUrl(url: string, child: ChildProcess, timeoutMs = 180_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (child.exitCode !== null) throw new Error(`Website server exited with code ${child.exitCode}`)
    try {
      const response = await fetch(url)
      if (response.status < 500) return
    } catch {}
    await delay(500)
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function stopChild(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return
  child.kill('SIGTERM')
  await Promise.race([
    new Promise<void>((resolve) => child.once('exit', () => resolve())),
    delay(10_000).then(() => {
      if (child.exitCode === null) child.kill('SIGKILL')
    }),
  ])
}

function closeServer(server: Server | undefined) {
  if (!server) return Promise.resolve()
  return new Promise<void>((resolve) => server.close(() => resolve()))
}

async function seedSyntheticInquiry() {
  const [{ createLocalReq, getPayload }, { default: config }, fixtures, users, communication, notifications] =
    await Promise.all([
      import('payload'),
      import('@payload-config'),
      import('../tests/fixtures/createClinicFixture'),
      import('../tests/fixtures/testUsers'),
      import('../src/features/inquiryCommunication/service'),
      import('../src/features/clinicNotifications/service'),
    ])
  const payload = await getPayload({ config })
  try {
    const cities = await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })
    const city = cities.docs[0]
    if (!city) throw new Error('Expected the baseline city fixture')

    const clinicFixture = await fixtures.createClinicFixture(payload, city.id, {
      slugPrefix: 'cross-app-acceptance',
    })
    const foreignFixture = await fixtures.createClinicFixture(payload, city.id, {
      clinicIndex: 1,
      doctorIndex: 1,
      slugPrefix: 'cross-app-acceptance-foreign',
    })
    for (const clinicId of [clinicFixture.clinic.id, foreignFixture.clinic.id]) {
      await payload.update({
        collection: 'clinics',
        data: { status: 'approved' },
        depth: 0,
        id: clinicId,
        overrideAccess: true,
      })
    }

    const patient = await users.createPatientTestUser(payload, {
      emailPrefix: 'cross-app-ada',
      firstName: 'Ada',
      lastName: 'Patient',
      supabaseUserId: subjects.patient,
    })
    const clinicStaff = await users.createClinicTestUser(payload, {
      emailPrefix: 'cross-app-clinic',
      firstName: 'Casey',
      lastName: 'Clinic',
      supabaseUserId: subjects.clinic,
    })
    const secondClinicStaff = await users.createClinicTestUser(payload, {
      emailPrefix: 'cross-app-second-clinic',
      firstName: 'Taylor',
      lastName: 'Clinic',
      supabaseUserId: subjects.secondClinic,
    })
    const foreignClinicStaff = await users.createClinicTestUser(payload, {
      emailPrefix: 'cross-app-foreign-clinic',
      firstName: 'Foreign',
      lastName: 'Clinic',
      supabaseUserId: subjects.foreignClinic,
    })
    for (const [staff, clinicId] of [
      [clinicStaff, clinicFixture.clinic.id],
      [secondClinicStaff, clinicFixture.clinic.id],
      [foreignClinicStaff, foreignFixture.clinic.id],
    ] as const) {
      await payload.update({
        collection: 'clinicStaff',
        context: { skipClinicStaffAuthSync: true },
        data: {
          authSync: { errorCode: null, status: 'synced' },
          clinic: clinicId,
          status: 'approved',
        },
        depth: 0,
        id: staff.id,
        overrideAccess: true,
      })
      const accessReady = await payload.findByID({
        collection: 'clinicStaff',
        id: staff.id,
        depth: 0,
        overrideAccess: true,
      })
      await users.completeLegacyClinicFixture(payload, accessReady, clinicId)
    }

    const patientReq = await createLocalReq({}, payload)
    patientReq.user = users.asPayloadPatientUser(patient)
    await notifications.activateClinicNotificationsForTest(patientReq)
    const created = await communication.createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicFixture.clinic.id),
      consent: true,
      doctorId: String(clinicFixture.doctor.id),
      idempotencyKey: 'cross-app-inquiry-create-0001',
      message: 'Synthetic cross-application treatment inquiry.',
      phoneNumber: '+493000000001',
      treatmentTimeline: 'within_two_weeks',
    })

    let notificationArrivals = 0
    let lastNotificationInquiryId: string | number | undefined
    return {
      clinicId: String(clinicFixture.clinic.id),
      clinicName: clinicFixture.clinic.name,
      close: () => payload.destroy(),
      controlRoutes: {
        '/remove-latest-patient-message': async () => {
          const latest = await payload.find({
            collection: 'inquiryMessages',
            where: { inquiry: { equals: created.inquiry.id } },
            sort: '-id',
            limit: 1,
            overrideAccess: true,
          })
          const message = latest.docs[0]
          if (!message) throw new Error('Expected an actual synthetic patient message')
          await payload.delete({ collection: 'inquiryMessages', id: message.id, overrideAccess: true })
        },
        '/create-patient-message': async () => {
          const req = await createLocalReq({}, payload)
          req.user = users.asPayloadPatientUser(patient)
          const detail = await communication.readPatientInquiryDetail(req, { inquiryId: created.inquiry.id })
          notificationArrivals += 1
          let attachmentDraftId: string | undefined
          if (notificationArrivals === 1) {
            const bytes = new Uint8Array(
              Buffer.from(
                'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
                'base64',
              ),
            )
            const draft = await communication.createAttachmentDraft(req, {
              inquiryId: created.inquiry.id,
              fileName: 'patient-message-proof.png',
              mimeType: 'image/png',
              sizeBytes: bytes.byteLength,
            })
            const uploaded = await fetch(draft.upload.url, {
              method: draft.upload.method,
              headers: draft.upload.headers,
              body: bytes,
            })
            if (!uploaded.ok) throw new Error('The isolated synthetic attachment upload failed')
            const finalized = await communication.finalizeAttachmentDraft(req, {
              inquiryId: created.inquiry.id,
              draftId: draft.draftId,
            })
            attachmentDraftId = finalized.attachment.id
          }
          const sent = await communication.sendPatientInquiryMessage(req, {
            inquiryId: created.inquiry.id,
            expectedRevision: detail.revision,
            idempotencyKey: `cross-app-patient-message-${notificationArrivals}`,
            ...(attachmentDraftId
              ? { attachmentDraftId }
              : { text: `Private synthetic grouped message ${notificationArrivals}.` }),
          })
          const occurrences = await payload.find({
            collection: 'clinicNotificationOccurrences',
            overrideAccess: true,
            depth: 0,
            where: {
              and: [
                { sourceRecordId: { equals: created.inquiry.id } },
                { eventType: { equals: 'patient_message_received' } },
              ],
            },
            sort: ['occurredAt', 'id'],
            limit: 100,
          })
          return {
            inquiryId: sent.inquiry.id,
            members: occurrences.docs.map((occurrence) => ({
              notificationId: occurrence.notificationId,
              sourceOccurrenceId: occurrence.sourceOccurrenceId,
              occurredAt: occurrence.occurredAt,
            })),
          }
        },
      },
      foreignClinicId: String(foreignFixture.clinic.id),
      foreignClinicName: foreignFixture.clinic.name,
      inquiryId: created.inquiry.id,
      createNotificationInquiry: async () => {
        notificationArrivals += 1
        const req = await createLocalReq({}, payload)
        const source = await communication.submitGuestClinicInquiry(req, {
          clinicId: clinicFixture.clinic.id,
          doctorId: clinicFixture.doctor.id,
          consent: true,
          email: `notification-arrival-${notificationArrivals}@example.com`,
          fullName: 'Notification Arrival',
          message: 'Private cross-app arrival text.',
          phoneNumber: '+493000000099',
        })
        lastNotificationInquiryId = source.id
        const occurrences = await payload.find({
          collection: 'clinicNotificationOccurrences',
          overrideAccess: true,
          where: { and: [{ sourceRecordKind: { equals: 'inquiry' } }, { sourceRecordId: { equals: source.id } }] },
          limit: 1,
        })
        const occurrence = occurrences.docs[0]
        if (!occurrence) throw new Error('Expected captured cross-app occurrence')
        return {
          inquiryId: source.id,
          notificationId: occurrence.notificationId,
          occurredAt: occurrence.occurredAt,
          displayName: 'Notification Arrival',
        }
      },
      removeNotificationInquiry: async () => {
        if (lastNotificationInquiryId === undefined) throw new Error('Expected a captured synthetic inquiry')
        await payload.update({
          collection: 'patientClinicInquiries',
          id: lastNotificationInquiryId,
          data: { deletedAt: new Date().toISOString() },
          overrideAccess: true,
        })
      },
      offboardClinicStaff: async () => {
        await payload.update({
          collection: 'clinicStaff',
          context: { skipClinicStaffAuthSync: true },
          data: { status: 'offboarded' },
          depth: 0,
          id: clinicStaff.id,
          overrideAccess: true,
        })
      },
      users: new Map<string, SyntheticUser>([
        [
          tokens.secondClinic,
          {
            email: secondClinicStaff.email ?? 'second-clinic-staff@example.com',
            firstName: 'Taylor',
            id: subjects.secondClinic,
            lastName: 'Clinic',
            type: 'clinic',
          },
        ],
        [
          tokens.clinic,
          {
            email: clinicStaff.email ?? 'cross-app-clinic@example.com',
            firstName: 'Casey',
            id: subjects.clinic,
            lastName: 'Clinic',
            type: 'clinic',
          },
        ],
        [
          tokens.foreignClinic,
          {
            email: foreignClinicStaff.email ?? 'cross-app-foreign-clinic@example.com',
            firstName: 'Foreign',
            id: subjects.foreignClinic,
            lastName: 'Clinic',
            type: 'clinic',
          },
        ],
        [
          tokens.patient,
          {
            email: patient.email ?? 'cross-app-ada@example.com',
            firstName: 'Ada',
            id: subjects.patient,
            lastName: 'Patient',
            type: 'patient',
          },
        ],
      ]),
    }
  } catch (error: unknown) {
    await payload.destroy().catch(() => undefined)
    throw error
  }
}

function patientSessionCookie(users: ReadonlyMap<string, SyntheticUser>) {
  const user = users.get(tokens.patient)
  if (!user) throw new Error('Expected the synthetic patient')
  const session = {
    access_token: tokens.patient,
    expires_at: 4_102_444_800,
    expires_in: 2_315_000_000,
    refresh_token: 'cross-app-refresh-token',
    token_type: 'bearer',
    user: syntheticSupabaseUser(user),
  }
  return `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`
}

async function main() {
  loadLocalAndTestEnv()
  Object.assign(process.env, {
    DATABASE_URI: databaseUri,
    DATABASE_DIRECT_URI: databaseUri,
    CLINIC_DASHBOARD_URL: `http://127.0.0.1:${Number(process.env.CLINIC_DASHBOARD_CROSS_APP_PORT ?? '3101')}`,
    DEPLOYMENT_ENV: 'test',
    NEXT_PUBLIC_DEPLOYMENT_ENV: 'test',
    NEXT_PUBLIC_SERVER_URL: websiteOrigin,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'cross-app-anon-key',
    NEXT_PUBLIC_SUPABASE_URL: authOrigin,
    TEMPORARY_LANDING_MODE_ENABLED: 'false',
  })

  let authServer: Server | undefined
  let controlServer: Server | undefined
  let fixture: Awaited<ReturnType<typeof seedSyntheticInquiry>> | undefined
  let websiteServer: ChildProcess | undefined
  try {
    await setupTestDatabase({ templateKind: 'baseline' })
    fixture = await seedSyntheticInquiry()
    authServer = await startAuthStub(fixture.users)
    controlServer = await startControlServer(
      fixture.offboardClinicStaff,
      fixture.createNotificationInquiry,
      fixture.removeNotificationInquiry,
      fixture.controlRoutes,
    )
    websiteServer = spawn('pnpm', ['dev', '--hostname', '127.0.0.1', '--port', '3200'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    })
    await waitForUrl(`${websiteOrigin}/api/clinic-dashboard/bootstrap`, websiteServer)

    const dashboardRun = spawn('pnpm', ['exec', 'playwright', 'test', '--config=playwright.cross-app.config.ts'], {
      cwd: resolvedDashboardDirectory,
      env: {
        ...process.env,
        INQUIRY_ACCEPTANCE_CLINIC_ID: fixture.clinicId,
        INQUIRY_ACCEPTANCE_CLINIC_NAME: fixture.clinicName,
        INQUIRY_ACCEPTANCE_CLINIC_TOKEN: tokens.clinic,
        INQUIRY_ACCEPTANCE_SECOND_CLINIC_TOKEN: tokens.secondClinic,
        INQUIRY_ACCEPTANCE_CONTROL_ORIGIN: controlOrigin,
        INQUIRY_ACCEPTANCE_CONTROL_TOKEN: controlToken,
        INQUIRY_ACCEPTANCE_FOREIGN_CLINIC_ID: fixture.foreignClinicId,
        INQUIRY_ACCEPTANCE_FOREIGN_CLINIC_NAME: fixture.foreignClinicName,
        INQUIRY_ACCEPTANCE_FOREIGN_CLINIC_TOKEN: tokens.foreignClinic,
        INQUIRY_ACCEPTANCE_FOREIGN_DASHBOARD_ORIGIN: 'http://127.0.0.1:3102',
        INQUIRY_ACCEPTANCE_INQUIRY_ID: fixture.inquiryId,
        INQUIRY_ACCEPTANCE_PATIENT_SESSION_COOKIE: patientSessionCookie(fixture.users),
        INQUIRY_ACCEPTANCE_PATIENT_TOKEN: tokens.patient,
        INQUIRY_ACCEPTANCE_WEBSITE_ORIGIN: websiteOrigin,
      },
      stdio: 'inherit',
    })
    const exitCode = await new Promise<number>((resolve) => dashboardRun.once('exit', (code) => resolve(code ?? 1)))
    if (exitCode !== 0) throw new Error(`Cross-app Playwright lane failed with exit code ${exitCode}`)
  } finally {
    await stopChild(websiteServer)
    await closeServer(controlServer)
    await closeServer(authServer)
    await fixture?.close().catch(() => undefined)
    await teardownTestDatabase()
  }
}

try {
  await main()
  process.exit(0)
} catch (error: unknown) {
  console.error(error)
  process.exit(1)
}
