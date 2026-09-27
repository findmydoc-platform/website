import http from 'node:http'
import https from 'node:https'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, type CollectionAfterChangeHook, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { POST as submitClinicRegistrationRoute } from '@/app/api/auth/register/clinic/route'
import { submitClinicRegistration as submitClinicRegistrationService } from '@/features/clinicRegistration/service'
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

  function requestFor(contactEmail: string) {
    return new NextRequest('http://localhost/api/auth/register/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName: `${prefix} Atomic Clinic`,
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

      expect(response.status).toBe(202)
      await expect(response.json()).resolves.toEqual({ success: true })
      expect(await storedCounts(contactEmail)).toEqual({ applications: 1, operations: 0, events: 0 })
      const stored = await observer.query<{ id: number }>(
        'SELECT id FROM clinic_applications WHERE contact_email = $1',
        [contactEmail],
      )
      applicationIds.push(stored.rows[0]!.id)
    },
  )
})
