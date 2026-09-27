import { createHash } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { closeDeliveryEdgeNetworkBoundary, deliveryEdgeNetworkGuard: networkGuard } = await vi.hoisted(
  () => import('../helpers/deliveryEdgeNetworkBoundary'),
)

const postHogMocks = vi.hoisted(() => ({
  registerClinicSubmitted: vi.fn(async () => undefined),
  resolveAnalyticsConsent: vi.fn(async () => ({ isAllowed: true })),
  resolveAnonymousPostHogActor: vi.fn(() => ({
    distinctId: 'clinic-registration-delivery-continuity',
    isAuthenticated: false,
    personProperties: { is_authenticated: 'false', user_type: 'anonymous' },
    userType: 'anonymous',
  })),
}))

vi.mock('@/auth/utilities/jwtValidation', () => ({ extractSupabaseUserData: async () => null }))
vi.mock('@react-email/render', { spy: true })
vi.mock('@/posthog/api', () => ({
  postHogServerConsent: { resolveAnalyticsConsent: postHogMocks.resolveAnalyticsConsent },
  postHogServerEvents: { registerClinicSubmitted: postHogMocks.registerClinicSubmitted },
  resolveAnonymousPostHogActor: postHogMocks.resolveAnonymousPostHogActor,
}))

import * as emailRenderer from '@react-email/render'
import { NextRequest } from 'next/server'
import { createLocalReq, getPayload, type Payload } from 'payload'
import pg from 'pg'
import config from '@payload-config'
import { POST as submitClinicRegistration } from '@/app/api/auth/register/clinic/route'
import {
  createFakeDeliveryAdapter,
  type DeliveryAttempt,
  type DeliveryOutcome,
} from '@/features/transactionalEmail/delivery'
import { createTransactionalEmailWorker } from '@/features/transactionalEmail/worker'
import { cleanupTransactionalEmailFixtures } from '../fixtures/cleanupTransactionalEmailFixtures'
import { testSlug } from '../fixtures/testSlug'
import { assertNoPrivateEvidence } from '../helpers/deliveryEdgeEvidence'

type StoredOperation = {
  application_id: number
  attempt_count: string
  command_payload: unknown
  first_ambiguous_at: Date | null
  next_attempt_at: Date | null
  operation_id: number
  operation_reference: string
  prepared_html: string | null
  prepared_subject: string | null
  prepared_text: string | null
  provider_idempotency_key: string
  recipient_address: string | null
  state: string
}

type StoredDeliveryEvent = {
  outcome_code: string | null
  type: string
}

const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex')

describe('public clinic-registration receipt delivery continuity', () => {
  let payload: Payload
  let observer: pg.Client
  let specialtyId: number
  const applicationIds: number[] = []
  const operationReferences: string[] = []
  const prefix = testSlug('clinicRegistration.deliveryContinuity.test.ts')

  beforeAll(async () => {
    expect(networkGuard.isInstalled()).toBe(true)
    payload = await getPayload({ config })
    const specialty = await payload.create({
      collection: 'medical-specialties',
      data: {
        name: `${prefix} Delivery Continuity Specialty`,
        description: 'Synthetic specialty for clinic-registration delivery continuity.',
        iconKey: 'fallback',
      },
      depth: 0,
      overrideAccess: true,
    })
    specialtyId = specialty.id
    observer = new pg.Client({ connectionString: process.env.DATABASE_URI })
    await observer.connect()
  }, 60_000)

  beforeEach(() => {
    vi.stubEnv('CI', 'false')
    postHogMocks.resolveAnalyticsConsent.mockResolvedValue({ isAllowed: true })
  })

  afterEach(() => {
    try {
      networkGuard.assertNoAttempts()
    } finally {
      vi.clearAllMocks()
      vi.restoreAllMocks()
      vi.unstubAllEnvs()
      networkGuard.reinstall()
      networkGuard.resetAttempts()
    }
  })

  afterAll(async () => {
    try {
      await cleanupTransactionalEmailFixtures(payload, operationReferences)
      for (const id of applicationIds) {
        await payload.delete({ collection: 'clinicApplications', id, overrideAccess: true })
      }
      await payload.delete({ collection: 'medical-specialties', id: specialtyId, overrideAccess: true })
    } finally {
      try {
        await observer?.end()
        networkGuard.assertNoAttempts()
      } finally {
        closeDeliveryEdgeNetworkBoundary()
      }
    }
  })

  function registrationRequest(contactEmail: string, clinicName: string) {
    return new NextRequest('http://localhost/api/auth/register/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clinicName,
        clinicWebsite: 'https://delivery-continuity-clinic.example',
        contactFirstName: 'Ada',
        contactLastName: 'Lovelace',
        contactEmail,
        contactRole: 'Clinic Management',
        medicalSpecialties: [specialtyId],
      }),
    })
  }

  async function storedOperation(contactEmail: string): Promise<StoredOperation> {
    const result = await observer.query<StoredOperation>(
      `SELECT
        clinic_applications.id AS application_id,
        transactional_email_outbox.id AS operation_id,
        transactional_email_outbox.operation_reference,
        transactional_email_outbox.state,
        transactional_email_outbox.command_payload,
        transactional_email_outbox.recipient_address,
        transactional_email_outbox.prepared_subject,
        transactional_email_outbox.prepared_html,
        transactional_email_outbox.prepared_text,
        transactional_email_outbox.provider_idempotency_key,
        transactional_email_outbox.attempt_count,
        transactional_email_outbox.next_attempt_at,
        transactional_email_outbox.first_ambiguous_at
      FROM clinic_applications
      JOIN transactional_email_outbox
        ON transactional_email_outbox.operation_reference = clinic_applications.id::text
      WHERE clinic_applications.contact_email = $1`,
      [contactEmail],
    )
    expect(result.rowCount).toBe(1)
    const stored = result.rows[0]!
    if (!applicationIds.includes(stored.application_id)) applicationIds.push(stored.application_id)
    if (!operationReferences.includes(stored.operation_reference)) {
      operationReferences.push(stored.operation_reference)
    }
    return stored
  }

  async function durableCounts(contactEmail: string, operationId: number) {
    const result = await observer.query<{
      applications: number
      command_events: number
      operations: number
    }>(
      `SELECT
        (SELECT count(*)::int FROM clinic_applications WHERE contact_email = $1) AS applications,
        (SELECT count(*)::int FROM transactional_email_outbox WHERE recipient_address = $1 OR id = $2) AS operations,
        (SELECT count(*)::int FROM transactional_email_events
          WHERE outbox_id = $2 AND type = 'command.accepted') AS command_events`,
      [contactEmail, operationId],
    )
    return result.rows[0]!
  }

  async function deliveryEvents(operationId: number): Promise<StoredDeliveryEvent[]> {
    const result = await observer.query<StoredDeliveryEvent>(
      `SELECT type, outcome_code
      FROM transactional_email_events
      WHERE outbox_id = $1
        AND type IN (
          'command.accepted',
          'preparation.completed',
          'delivery.attempt-started',
          'delivery.retry-scheduled',
          'delivery.ambiguous',
          'delivery.accepted',
          'delivery.failed',
          'payload.scrubbed'
        )
      ORDER BY sequence`,
      [operationId],
    )
    return result.rows
  }

  function expectPrivacySafeDeliveryLogs(log: ReturnType<typeof vi.fn>) {
    const expectedKeys = [
      'attemptNumber',
      'commandType',
      'durationBucket',
      'environment',
      'operationId',
      'outboxState',
      'outcomeCode',
      'queueAgeBucket',
    ]
    for (const [entry] of log.mock.calls) {
      expect(Object.keys(entry as Record<string, unknown>).sort()).toEqual(expectedKeys)
    }
  }

  function scriptedFakeTransport(outcomes: DeliveryOutcome[]) {
    const attempts: DeliveryAttempt[] = []
    const base = createFakeDeliveryAdapter()
    const deliver = vi.spyOn(base, 'deliver').mockImplementation(async (attempt) => {
      attempts.push(attempt)
      const outcome = outcomes.shift()
      if (!outcome) throw new Error('Scripted fake transport exhausted')
      return outcome
    })
    return { attempts, deliver, transport: base }
  }

  it('reuses one accepted receipt through retryable, ambiguous, and successful attempts', async () => {
    const contactEmail = `${prefix}-retry@clinic.example`
    const clinicName = `${prefix} Retry Clinic`
    const genericSend = vi.spyOn(payload, 'sendEmail')
    const response = await submitClinicRegistration(registrationRequest(contactEmail, clinicName))

    expect(response.status).toBe(202)
    await expect(response.json()).resolves.toEqual({ success: true })
    const accepted = await storedOperation(contactEmail)
    expect(accepted).toMatchObject({
      attempt_count: '0',
      command_payload: {
        registrationId: accepted.application_id,
        type: 'clinic.registration-received',
      },
      operation_reference: String(accepted.application_id),
      recipient_address: contactEmail,
      state: 'queued',
    })
    expect(await durableCounts(contactEmail, accepted.operation_id)).toEqual({
      applications: 1,
      command_events: 1,
      operations: 1,
    })

    let now = Date.now()
    const fake = scriptedFakeTransport([
      { type: 'retryable', outcomeCode: 'provider-temporary' },
      { type: 'ambiguous', outcomeCode: 'provider-ambiguous' },
      { type: 'accepted', messageId: 'fake-clinic-registration-receipt', outcomeCode: 'provider-accepted' },
    ])
    const log = vi.fn()
    const workerReq = await createLocalReq({}, payload)
    const worker = createTransactionalEmailWorker(workerReq, {
      delivery: fake.transport,
      log,
      now: () => now,
      suppression: async () => 'cleared' as const,
    })

    await worker.run(String(accepted.operation_id))

    const retryable = await storedOperation(contactEmail)
    expect(retryable.state).toBe('prepared')
    expect(Number(retryable.attempt_count)).toBe(1)
    expect(retryable.next_attempt_at?.getTime()).toBe(now + 60_000)
    expect(retryable.prepared_subject).toBe('We received your clinic registration')
    expect(retryable.prepared_html).toContain('Ada Lovelace')
    expect(retryable.prepared_html).toContain(clinicName)
    expect(retryable.prepared_text).toContain('findmydoc will review the information and contact you separately.')
    expect(emailRenderer.render).toHaveBeenCalledOnce()

    now += 60_001
    await worker.run(String(accepted.operation_id))

    const ambiguous = await storedOperation(contactEmail)
    expect(ambiguous.state).toBe('prepared')
    expect(Number(ambiguous.attempt_count)).toBe(2)
    expect(ambiguous.first_ambiguous_at).not.toBeNull()
    expect(ambiguous.next_attempt_at?.getTime()).toBe(now + 300_000)
    expect(emailRenderer.render).toHaveBeenCalledOnce()

    now += 300_001
    await worker.run(String(accepted.operation_id))

    const completed = await storedOperation(contactEmail)
    expect(completed).toMatchObject({
      attempt_count: '3',
      command_payload: null,
      next_attempt_at: null,
      prepared_html: null,
      prepared_subject: null,
      prepared_text: null,
      recipient_address: null,
      state: 'accepted',
    })
    expect(await durableCounts(contactEmail, accepted.operation_id)).toEqual({
      applications: 1,
      command_events: 1,
      operations: 1,
    })
    expect(await deliveryEvents(accepted.operation_id)).toEqual([
      { outcome_code: null, type: 'command.accepted' },
      { outcome_code: null, type: 'preparation.completed' },
      { outcome_code: null, type: 'delivery.attempt-started' },
      { outcome_code: 'provider-temporary', type: 'delivery.retry-scheduled' },
      { outcome_code: null, type: 'delivery.attempt-started' },
      { outcome_code: 'provider-ambiguous', type: 'delivery.ambiguous' },
      { outcome_code: null, type: 'delivery.attempt-started' },
      { outcome_code: 'provider-accepted', type: 'delivery.accepted' },
      { outcome_code: null, type: 'payload.scrubbed' },
    ])
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledOnce()
    expect(emailRenderer.render).toHaveBeenCalledOnce()
    expect(fake.deliver).toHaveBeenCalledTimes(3)
    expect(genericSend).not.toHaveBeenCalled()

    const attempts = fake.attempts
    expect(attempts).toHaveLength(3)
    expect(attempts[0]).toMatchObject({
      recipientAddress: contactEmail,
      subject: 'We received your clinic registration',
    })
    for (const field of ['recipientAddress', 'subject', 'html', 'text', 'providerIdempotencyKey'] as const) {
      expect(new Set(attempts.map((attempt) => fingerprint(attempt[field]))).size).toBe(1)
    }
    expect(attempts[0]!.providerIdempotencyKey === accepted.provider_idempotency_key).toBe(true)

    const safeLogEvidence = log.mock.calls.map(([entry]) => {
      const event = entry as Record<string, unknown>
      return {
        attemptNumber: event.attemptNumber,
        commandType: event.commandType,
        environment: event.environment,
        operationId: event.operationId,
        outboxState: event.outboxState,
        outcomeCode: event.outcomeCode,
      }
    })
    expect(safeLogEvidence).toEqual([
      expect.objectContaining({
        attemptNumber: 1,
        operationId: String(accepted.operation_id),
        outboxState: 'prepared',
        outcomeCode: 'provider-temporary',
      }),
      expect.objectContaining({
        attemptNumber: 2,
        operationId: String(accepted.operation_id),
        outboxState: 'prepared',
        outcomeCode: 'provider-ambiguous',
      }),
      expect.objectContaining({
        attemptNumber: 3,
        operationId: String(accepted.operation_id),
        outboxState: 'accepted',
        outcomeCode: 'provider-accepted',
      }),
    ])
    expectPrivacySafeDeliveryLogs(log)
    assertNoPrivateEvidence(log.mock.calls, [
      contactEmail,
      clinicName,
      'Ada Lovelace',
      attempts[0]!.subject,
      attempts[0]!.html,
      attempts[0]!.text,
      attempts[0]!.providerIdempotencyKey,
    ])
  })

  it('terminates a permanent rejection without another delivery path', async () => {
    const contactEmail = `${prefix}-permanent@clinic.example`
    const clinicName = `${prefix} Permanent Clinic`
    const genericSend = vi.spyOn(payload, 'sendEmail')
    const response = await submitClinicRegistration(registrationRequest(contactEmail, clinicName))
    expect(response.status).toBe(202)

    const accepted = await storedOperation(contactEmail)
    const fake = scriptedFakeTransport([{ type: 'permanent', outcomeCode: 'provider-policy-rejected' }])
    const log = vi.fn()
    const workerReq = await createLocalReq({}, payload)
    await createTransactionalEmailWorker(workerReq, {
      delivery: fake.transport,
      log,
      suppression: async () => 'cleared' as const,
    }).run(String(accepted.operation_id))

    const failed = await storedOperation(contactEmail)
    expect(failed).toMatchObject({
      attempt_count: '1',
      command_payload: null,
      next_attempt_at: null,
      prepared_html: null,
      prepared_subject: null,
      prepared_text: null,
      recipient_address: null,
      state: 'failed',
    })
    expect(await durableCounts(contactEmail, accepted.operation_id)).toEqual({
      applications: 1,
      command_events: 1,
      operations: 1,
    })
    expect(await deliveryEvents(accepted.operation_id)).toEqual([
      { outcome_code: null, type: 'command.accepted' },
      { outcome_code: null, type: 'preparation.completed' },
      { outcome_code: null, type: 'delivery.attempt-started' },
      { outcome_code: 'provider-policy-rejected', type: 'delivery.failed' },
      { outcome_code: null, type: 'payload.scrubbed' },
    ])
    expect(fake.deliver).toHaveBeenCalledOnce()
    expect(genericSend).not.toHaveBeenCalled()
    expect(postHogMocks.registerClinicSubmitted).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptNumber: 1,
        operationId: String(accepted.operation_id),
        outboxState: 'failed',
        outcomeCode: 'provider-policy-rejected',
      }),
    )
    expectPrivacySafeDeliveryLogs(log)
    assertNoPrivateEvidence(log.mock.calls, [
      contactEmail,
      clinicName,
      'Ada Lovelace',
      fake.attempts[0]!.subject,
      fake.attempts[0]!.html,
      fake.attempts[0]!.text,
      fake.attempts[0]!.providerIdempotencyKey,
    ])
  })
})
