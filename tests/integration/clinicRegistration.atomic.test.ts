import http from 'node:http'
import https from 'node:https'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createLocalReq,
  getPayload,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type Payload,
} from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { POST as submitClinicRegistrationRoute } from '@/app/api/auth/register/clinic/route'
import { submitClinicRegistration as submitClinicRegistrationService } from '@/features/clinicRegistration/service'
import type { DeliveryAdapter } from '@/features/transactionalEmail/delivery'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { asPayloadStaffUser, cleanupTrackedUsers, createPlatformTestUser } from '../fixtures/testUsers'

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))

type StoredRegistrationCounts = {
  applications: number
  events: number
  operations: number
}

describe('public clinic registration transaction', () => {
  let payload: Payload
  let observer: pg.Client
  let specialtyId: number
  const applicationIds: number[] = []
  const operationReferences: string[] = []
  const staffIds: Array<number | string> = []
  const prefix = testSlug('clinicRegistration.atomic.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const specialties = await payload.find({
      collection: 'medical-specialties',
      depth: 0,
      limit: 1,
      pagination: false,
      where: { parentSpecialty: { exists: false } },
    })
    specialtyId = specialties.docs[0]!.id
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60_000)

  beforeEach(() => {
    vi.stubEnv('CI', 'false')
    const deny = () => {
      throw new Error('External network forbidden')
    }
    vi.spyOn(globalThis, 'fetch').mockImplementation(deny)
    vi.spyOn(http, 'get').mockImplementation(deny)
    vi.spyOn(http, 'request').mockImplementation(deny)
    vi.spyOn(https, 'get').mockImplementation(deny)
    vi.spyOn(https, 'request').mockImplementation(deny)
  })

  afterEach(() => {
    try {
      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(http.get).not.toHaveBeenCalled()
      expect(http.request).not.toHaveBeenCalled()
      expect(https.get).not.toHaveBeenCalled()
      expect(https.request).not.toHaveBeenCalled()
    } finally {
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
    }
  })

  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, operationReferences)
      for (const id of applicationIds) {
        await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
      }
      await cleanupTrackedUsers(payload, { staffIds })
    } finally {
      await observer?.end()
    }
  })

  function requestFor(contactEmail: string, clinicName = `${prefix} Atomic Clinic`) {
    return new NextRequest('http://localhost/api/auth/register/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName,
        clinicWebsite: 'https://atomic-clinic.example',
        contactFirstName: 'Ada',
        contactLastName: 'Lovelace',
        contactEmail,
        contactRole: 'Clinic Management',
        medicalSpecialties: [specialtyId],
      }),
    })
  }

  async function storedCounts(contactEmail: string): Promise<StoredRegistrationCounts> {
    const result = await observer.query<StoredRegistrationCounts>(
      `SELECT
        (SELECT count(*)::int FROM clinic_applications WHERE contact_email = $1) AS applications,
        (SELECT count(*)::int FROM transactional_email_outbox WHERE recipient_address = $1) AS operations,
        (SELECT count(*)::int
          FROM transactional_email_events
          JOIN transactional_email_outbox
            ON transactional_email_outbox.id = transactional_email_events.outbox_id
          WHERE transactional_email_outbox.recipient_address = $1) AS events`,
      [contactEmail],
    )
    return result.rows[0]!
  }

  async function trackRegistrations(contactEmail: string) {
    const registrations = await observer.query<{ application_id: number; operation_reference: string | null }>(
      `SELECT clinic_applications.id AS application_id, transactional_email_outbox.operation_reference
      FROM clinic_applications
      LEFT JOIN transactional_email_outbox
        ON transactional_email_outbox.operation_reference = clinic_applications.id::text
      WHERE clinic_applications.contact_email = $1`,
      [contactEmail],
    )
    for (const registration of registrations.rows) {
      if (!applicationIds.includes(registration.application_id)) applicationIds.push(registration.application_id)
      if (registration.operation_reference && !operationReferences.includes(registration.operation_reference))
        operationReferences.push(registration.operation_reference)
    }
  }

  function serviceInput(contactEmail: string) {
    return {
      clinicName: `${prefix} Atomic Clinic`,
      clinicWebsite: 'https://atomic-clinic.example/',
      contactFirstName: 'Ada',
      contactLastName: 'Lovelace',
      contactEmail,
      contactRole: 'Clinic Management' as const,
      medicalSpecialtyIds: [specialtyId],
      sourceMeta: { ip: '', userAgent: '' },
    }
  }

  it('publishes the application, operation, and first event together after commit', async () => {
    const contactEmail = `${prefix}-commit@clinic.example`
    const nativeCommit = payload.db.commitTransaction.bind(payload.db)
    let releaseCommit!: () => void
    let commitReached!: () => void
    const heldCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve
    })
    const atCommit = new Promise<void>((resolve) => {
      commitReached = resolve
    })
    vi.spyOn(payload.db, 'commitTransaction').mockImplementationOnce(async (transactionID) => {
      commitReached()
      await heldCommit
      return nativeCommit(transactionID)
    })

    const responsePromise = submitClinicRegistrationRoute(requestFor(contactEmail))
    try {
      await atCommit
      expect(await storedCounts(contactEmail)).toEqual({ applications: 0, operations: 0, events: 0 })
    } finally {
      releaseCommit()
    }

    const response = await responsePromise
    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ success: true })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 1 })

    const stored = await observer.query<{ application_id: number; operation_reference: string }>(
      `SELECT clinic_applications.id AS application_id, transactional_email_outbox.operation_reference
      FROM clinic_applications
      JOIN transactional_email_outbox
        ON transactional_email_outbox.operation_reference = clinic_applications.id::text
      WHERE clinic_applications.contact_email = $1`,
      [contactEmail],
    )
    const registration = stored.rows[0]!
    expect(registration.operation_reference).toBe(String(registration.application_id))
    applicationIds.push(registration.application_id)
    operationReferences.push(registration.operation_reference)
  })

  it('returns the neutral response and preserves one queued receipt for a repeated submission', async () => {
    const contactEmail = `${prefix}-queued-repeat@clinic.example`

    const first = await submitClinicRegistrationRoute(requestFor(contactEmail))
    const second = await submitClinicRegistrationRoute(requestFor(contactEmail))

    expect(first.status).toBe(202)
    expect(second.status).toBe(202)
    await expect(first.json()).resolves.toEqual({ success: true })
    await expect(second.json()).resolves.toEqual({ success: true })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 1 })
    expect(
      (
        await observer.query('SELECT state FROM transactional_email_outbox WHERE recipient_address = $1', [
          contactEmail,
        ])
      ).rows,
    ).toEqual([{ state: 'queued' }])
    await trackRegistrations(contactEmail)
  })

  it('does not create a second receipt after delivery when the submission repeats', async () => {
    const contactEmail = `${prefix}-delivered-repeat@clinic.example`
    const first = await submitClinicRegistrationRoute(requestFor(contactEmail))
    expect(first.status).toBe(202)
    await observer.query("UPDATE transactional_email_outbox SET state = 'delivered' WHERE recipient_address = $1", [
      contactEmail,
    ])

    const repeated = await submitClinicRegistrationRoute(requestFor(contactEmail))

    expect(repeated.status).toBe(202)
    await expect(repeated.json()).resolves.toEqual({ success: true })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 1 })
    expect(
      (
        await observer.query('SELECT state FROM transactional_email_outbox WHERE recipient_address = $1', [
          contactEmail,
        ])
      ).rows,
    ).toEqual([{ state: 'delivered' }])
    await trackRegistrations(contactEmail)
  })

  it('keeps the same retryable receipt for a repeated submission', async () => {
    const contactEmail = `${prefix}-retryable-repeat@clinic.example`
    const first = await submitClinicRegistrationRoute(requestFor(contactEmail))
    expect(first.status).toBe(202)
    const operation = await observer.query<{ id: number }>(
      'SELECT id FROM transactional_email_outbox WHERE recipient_address = $1',
      [contactEmail],
    )
    const delivery: DeliveryAdapter = { deliver: vi.fn(async () => ({ type: 'retryable' as const })) }
    const workerReq = await createLocalReq({}, payload)
    await createTransactionalEmailWorker(workerReq, {
      delivery,
      suppression: async () => 'cleared' as const,
    }).run(String(operation.rows[0]!.id))

    const repeated = await submitClinicRegistrationRoute(requestFor(contactEmail))

    expect(repeated.status).toBe(202)
    await expect(repeated.json()).resolves.toEqual({ success: true })
    expect(delivery.deliver).toHaveBeenCalledOnce()
    expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 5 })
    expect(
      (
        await observer.query(
          'SELECT state, attempt_count, next_attempt_at FROM transactional_email_outbox WHERE recipient_address = $1',
          [contactEmail],
        )
      ).rows,
    ).toEqual([
      expect.objectContaining({
        state: 'prepared',
        attempt_count: '1',
        next_attempt_at: expect.any(Date),
      }),
    ])
    await trackRegistrations(contactEmail)
  })

  it('returns the neutral response without a receipt for an approved application', async () => {
    const contactEmail = `${prefix}-approved-repeat@clinic.example`
    const first = await submitClinicRegistrationRoute(requestFor(contactEmail))
    expect(first.status).toBe(202)
    await observer.query("UPDATE clinic_applications SET status = 'approved' WHERE contact_email = $1", [contactEmail])

    const repeated = await submitClinicRegistrationRoute(requestFor(contactEmail))

    expect(repeated.status).toBe(202)
    await expect(repeated.json()).resolves.toEqual({ success: true })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 1 })
    expect(
      (await observer.query('SELECT status FROM clinic_applications WHERE contact_email = $1', [contactEmail])).rows,
    ).toEqual([{ status: 'approved' }])
    await trackRegistrations(contactEmail)
  })

  it('creates independent receipts for different clinic names sharing one normalized email', async () => {
    const contactEmail = `${prefix}-same-email@clinic.example`

    const first = await submitClinicRegistrationRoute(
      requestFor(`  ${contactEmail.toUpperCase()}  `, `${prefix} Clinic A`),
    )
    const second = await submitClinicRegistrationRoute(requestFor(contactEmail, `${prefix} Clinic B`))

    expect(first.status).toBe(202)
    expect(second.status).toBe(202)
    await expect(first.json()).resolves.toEqual({ success: true })
    await expect(second.json()).resolves.toEqual({ success: true })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 2, operations: 2, events: 2 })
    await trackRegistrations(contactEmail)
  })

  it('converges concurrent identical submissions on one application and one receipt', async () => {
    const contactEmail = `${prefix}-concurrent@clinic.example`
    const applicationHooks = payload.collections.clinicApplications.config.hooks.beforeChange
    let releaseWrites!: () => void
    let bothWriting!: () => void
    const writesReleased = new Promise<void>((resolve) => {
      releaseWrites = resolve
    })
    const bothWritesReached = new Promise<void>((resolve) => {
      bothWriting = resolve
    })
    let writes = 0
    const synchronize: CollectionBeforeChangeHook = async ({ data }) => {
      if (data.contactEmail === contactEmail) {
        writes++
        if (writes === 2) bothWriting()
        await writesReleased
      }
      return data
    }
    applicationHooks.push(synchronize)

    try {
      const first = submitClinicRegistrationRoute(requestFor(contactEmail))
      const second = submitClinicRegistrationRoute(requestFor(contactEmail))
      await bothWritesReached
      releaseWrites()
      const responses = await Promise.all([first, second])

      expect(responses.map(({ status }) => status)).toEqual([202, 202])
      await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
        { success: true },
        { success: true },
      ])
      expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 1, events: 1 })
      await trackRegistrations(contactEmail)
    } finally {
      applicationHooks.splice(applicationHooks.indexOf(synchronize), 1)
    }
  })

  it('rolls back the complete registration when command storage fails', async () => {
    const contactEmail = `${prefix}-storage-failure@clinic.example`
    const eventHooks = payload.collections.transactionalEmailEvents.config.hooks.beforeChange
    const failStorage = () => {
      throw new Error('synthetic private event storage detail')
    }
    eventHooks.push(failStorage)
    const errorLog = vi.spyOn(payload.logger, 'error')

    try {
      const response = await submitClinicRegistrationRoute(requestFor(contactEmail))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
        error: 'Clinic registration could not be completed. Please try again.',
      })
      expect(await storedCounts(contactEmail)).toEqual({ applications: 0, operations: 0, events: 0 })

      expect(errorLog).toHaveBeenCalledWith(
        { errorCode: 'clinic-registration-unavailable' },
        'Clinic registration transaction failed',
      )
    } finally {
      eventHooks.splice(eventHooks.indexOf(failStorage), 1)
    }
  })

  it('rolls back the complete registration when the catalog source cannot be authorized', async () => {
    const contactEmail = `${prefix}-source-failure@clinic.example`
    const applicationHooks = payload.collections.clinicApplications.config.hooks.afterChange
    const removeCatalogSource: CollectionAfterChangeHook = async ({ doc, req }) => {
      await req.payload.delete({
        collection: 'clinicApplications',
        id: doc.id,
        req,
        overrideAccess: true,
      })
      return doc
    }
    applicationHooks.push(removeCatalogSource)
    const errorLog = vi.spyOn(payload.logger, 'error')

    try {
      const response = await submitClinicRegistrationRoute(requestFor(contactEmail))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
        error: 'Clinic registration could not be completed. Please try again.',
      })
      expect(await storedCounts(contactEmail)).toEqual({ applications: 0, operations: 0, events: 0 })
      expect(errorLog).toHaveBeenCalledWith(
        { errorCode: 'clinic-registration-unavailable' },
        'Clinic registration transaction failed',
      )
    } finally {
      applicationHooks.splice(applicationHooks.indexOf(removeCatalogSource), 1)
    }
  })

  it.each([
    ['commit', 'P0001', 1],
    ['serialization', '40001', 3],
  ] as const)('rolls back the complete registration after %s failure', async (label, errorCode, expectedAttempts) => {
    const contactEmail = `${prefix}-${label}-failure@clinic.example`
    const sequenceName = `clinic_registration_${label}_attempt`
    const functionName = `clinic_registration_${label}_failure`
    const triggerName = `clinic_registration_${label}_failure`
    await observer.query(`CREATE SEQUENCE ${sequenceName}`)
    await observer.query(`CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        PERFORM nextval('${sequenceName}');
        RAISE EXCEPTION 'synthetic private commit detail' USING ERRCODE = '${errorCode}';
      END;
    $$`)
    await observer.query(`CREATE CONSTRAINT TRIGGER ${triggerName}
      AFTER INSERT ON transactional_email_events DEFERRABLE INITIALLY DEFERRED
      FOR EACH ROW EXECUTE FUNCTION ${functionName}()`)

    try {
      const response = await submitClinicRegistrationRoute(requestFor(contactEmail))

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toEqual({
        error: 'Clinic registration could not be completed. Please try again.',
      })
      expect(await storedCounts(contactEmail)).toEqual({ applications: 0, operations: 0, events: 0 })
      const attempts = await observer.query<{ attempts: number }>(
        `SELECT last_value::int AS attempts FROM ${sequenceName}`,
      )
      expect(attempts.rows).toEqual([{ attempts: expectedAttempts }])
    } finally {
      await observer.query(`DROP TRIGGER ${triggerName} ON transactional_email_events`)
      await observer.query(`DROP FUNCTION ${functionName}()`)
      await observer.query(`DROP SEQUENCE ${sequenceName}`)
    }
  })

  it('rolls back a real authenticated request when command access is denied', async () => {
    const contactEmail = `${prefix}-access-denied@clinic.example`
    const user = await createPlatformTestUser(payload, {
      createdStaffIds: staffIds,
      emailPrefix: `${prefix}-access-denied`,
    })
    const authenticatedReq = await createLocalReq({ user: asPayloadStaffUser(user) }, payload)

    await expect(submitClinicRegistrationService(authenticatedReq, serviceInput(contactEmail))).rejects.toMatchObject({
      code: 'clinic-registration-unavailable',
      cause: { code: 'access-denied' },
    })
    expect(await storedCounts(contactEmail)).toEqual({ applications: 0, operations: 0, events: 0 })
  })

  it.each(['preview', 'production'] as const)(
    'keeps %s application-only while the command has no activation declaration',
    async (environment) => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('VERCEL_ENV', environment)
      vi.stubEnv('DEPLOYMENT_ENV', environment)
      const contactEmail = `${prefix}-${environment}-inactive@clinic.example`

      const response = await submitClinicRegistrationRoute(requestFor(contactEmail))
      const repeated = await submitClinicRegistrationRoute(requestFor(contactEmail))

      expect(response.status).toBe(202)
      expect(repeated.status).toBe(202)
      await expect(response.json()).resolves.toEqual({ success: true })
      await expect(repeated.json()).resolves.toEqual({ success: true })
      expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 0, events: 0 })
      const stored = await observer.query<{ id: number }>(
        'SELECT id FROM clinic_applications WHERE contact_email = $1',
        [contactEmail],
      )
      applicationIds.push(stored.rows[0]!.id)
    },
  )

  it('converges concurrent hosted-inactive submissions on one application', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('VERCEL_ENV', 'preview')
    vi.stubEnv('DEPLOYMENT_ENV', 'preview')
    const contactEmail = `${prefix}-preview-inactive-concurrent@clinic.example`
    const applicationHooks = payload.collections.clinicApplications.config.hooks.beforeChange
    let releaseWrites!: () => void
    let bothWriting!: () => void
    const writesReleased = new Promise<void>((resolve) => {
      releaseWrites = resolve
    })
    const bothWritesReached = new Promise<void>((resolve) => {
      bothWriting = resolve
    })
    let writes = 0
    const synchronize: CollectionBeforeChangeHook = async ({ data }) => {
      if (data.contactEmail === contactEmail) {
        writes++
        if (writes === 2) bothWriting()
        await writesReleased
      }
      return data
    }
    applicationHooks.push(synchronize)

    try {
      const first = submitClinicRegistrationRoute(requestFor(contactEmail))
      const second = submitClinicRegistrationRoute(requestFor(contactEmail))
      await bothWritesReached
      releaseWrites()
      const responses = await Promise.all([first, second])

      expect(responses.map(({ status }) => status)).toEqual([202, 202])
      await expect(Promise.all(responses.map((response) => response.json()))).resolves.toEqual([
        { success: true },
        { success: true },
      ])
      expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 0, events: 0 })
      await trackRegistrations(contactEmail)
    } finally {
      applicationHooks.splice(applicationHooks.indexOf(synchronize), 1)
    }
  })
})
