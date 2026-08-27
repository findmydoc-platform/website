import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, handleEndpoints, type Payload } from 'payload'

import config from '@payload-config'
import { createVerifiedPatientInquiry, sendPatientInquiryMessage } from '@/features/inquiryCommunication/service'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
} from '../fixtures/testUsers'

type SyntheticBearerUser = {
  email: string
  subject: string
}

const syntheticBearerUsers = vi.hoisted(() => new Map<string, SyntheticBearerUser>())

vi.mock('@/auth/utilities/supaBaseServer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/auth/utilities/supaBaseServer')>()
  return {
    ...actual,
    createClient: async () => ({
      auth: {
        getUser: async (token?: string) => {
          const user = token ? syntheticBearerUsers.get(token) : undefined
          if (!user) {
            return {
              data: { user: null },
              error: { message: 'Synthetic bearer token is invalid.', name: 'AuthApiError', status: 401 },
            }
          }

          return {
            data: {
              user: {
                app_metadata: { user_type: 'platform' },
                email: user.email,
                id: user.subject,
                user_metadata: { first_name: 'Retention', last_name: 'Operator' },
              },
            },
            error: null,
          }
        },
      },
    }),
  }
})

const requestRegisteredPayloadEndpoint = (path: string, token?: string, body: unknown = {}): Promise<Response> =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, 'https://payload-http-boundary.test'), {
      body: JSON.stringify(body),
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
      },
      method: 'POST',
    }),
  })

describe('inquiry retention registered Payload HTTP boundary', () => {
  let payload: Payload
  let clinicId: number
  let inquiryId: number | string
  let messageId: string
  let operationalInquiryId: number | string
  let operatorId: number | string
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const operatorToken = 'synthetic-retention-http-token'
  const slugPrefix = testSlug('inquiryRetention.http.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for retention HTTP tests.')
    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })
    const availableStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
    })
    await asClinicScopedPayloadUser(payload, availableStaff, clinicId)

    const operatorSubject = `${slugPrefix}-operator`
    const operator = await payload.create({
      collection: 'platformStaff',
      context: { trustedPlatformStaffOps: true },
      data: {
        capabilities: ['inquiry-retention'],
        email: `${slugPrefix}-operator@findmydoc.eu`,
        firstName: 'Retention',
        lastName: 'Operator',
        role: 'support',
        supabaseUserId: operatorSubject,
      },
      depth: 0,
      overrideAccess: true,
    })
    operatorId = operator.id
    syntheticBearerUsers.set(operatorToken, {
      email: operator.email ?? `${slugPrefix}-operator@findmydoc.eu`,
      subject: operatorSubject,
    })

    const legacy = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: clinicId,
        consent: { accepted: true, acceptedAt: '2024-01-15T12:00:00.000Z', text: 'Synthetic consent.' },
        createdAt: '2024-01-15T12:00:00.000Z',
        creationActorKey: `guest:${slugPrefix}`,
        creationRequestHash: slugPrefix,
        email: `${slugPrefix}-legacy@example.com`,
        fullName: 'Synthetic Legacy Patient',
        message: 'Synthetic legacy inquiry through the registered HTTP boundary.',
        phoneNumber: '+493000000088',
        status: 'closed',
      },
      depth: 0,
      overrideAccess: true,
    })
    inquiryId = legacy.id
    createdInquiryIds.push(legacy.id)

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    const patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const operational = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(fixture.doctor.id),
      idempotencyKey: `${slugPrefix}-operational-inquiry`,
      message: 'Synthetic inquiry for registered retention mutation evidence.',
      phoneNumber: '+493000000089',
    })
    operationalInquiryId = operational.inquiry.id
    createdInquiryIds.push(operationalInquiryId)
    const sent = await sendPatientInquiryMessage(patientReq, {
      expectedRevision: operational.inquiry.revision,
      idempotencyKey: `${slugPrefix}-operational-message`,
      inquiryId: operationalInquiryId,
      text: 'Synthetic message deleted through the registered retention endpoint.',
    })
    const message = sent.inquiry.timeline.find(
      (item) =>
        item.kind === 'external-message' &&
        item.text === 'Synthetic message deleted through the registered retention endpoint.',
    )
    if (!message) throw new Error('Expected the registered retention HTTP target message.')
    messageId = message.id.replace(/^message:/u, '')
  }, 60_000)

  afterAll(async () => {
    syntheticBearerUsers.clear()
    for (const collection of [
      'inquiryLegalHolds',
      'inquiryDeletionProofs',
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryInternalNotes',
      'inquiryAttachments',
      'inquiryConversations',
    ] as const) {
      await payload.delete({
        collection: collection as never,
        overrideAccess: true,
        where:
          collection === 'inquiryLegalHolds'
            ? { targetId: { in: createdInquiryIds.map(String) } }
            : collection === 'inquiryDeletionProofs'
              ? { inquiryId: { in: createdInquiryIds.map(String) } }
              : { inquiry: { in: createdInquiryIds } },
      } as never)
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
    }
    await payload.delete({ collection: 'platformStaff', id: operatorId, overrideAccess: true })
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: clinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
  })

  it('authenticates before input parsing and keeps private responses fail closed', async () => {
    const response = await requestRegisteredPayloadEndpoint('/api/platform/inquiry-retention/review-queue', undefined, {
      actorId: 'spoofed',
      unexpected: true,
    })

    expect(response.status).toBe(401)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toContain('Authorization')
    await expect(response.json()).resolves.toEqual({ error: { code: 'RETENTION_UNAUTHORIZED' } })
  })

  it('routes cutover and review queue through the registered private endpoints', async () => {
    const cutoverResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/cutover',
      operatorToken,
      { limit: 50 },
    )
    expect(cutoverResponse.status).toBe(200)
    await expect(cutoverResponse.json()).resolves.toEqual({ migrated: 1 })

    await payload.update({
      collection: 'patientClinicInquiries',
      context: { inquiryRetentionCommand: true },
      data: { retentionReviewDueAt: '2025-01-15T12:00:00.000Z' },
      depth: 0,
      id: inquiryId,
      overrideAccess: true,
    } as never)

    const queueResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/review-queue',
      operatorToken,
      { limit: 50, now: '2026-08-24T12:00:00.000Z' },
    )
    expect(queueResponse.status).toBe(200)
    expect(queueResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(queueResponse.headers.get('pragma')).toBe('no-cache')
    expect(queueResponse.headers.get('expires')).toBe('0')
    await expect(queueResponse.json()).resolves.toMatchObject({
      items: expect.arrayContaining([
        {
          id: String(inquiryId),
          policyVersion: '2026-08-24',
          reviewDueAt: '2025-01-15T12:00:00.000Z',
          targetType: 'inquiry',
        },
      ]),
    })

    const placeResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/legal-holds/place',
      operatorToken,
      {
        reasonCategory: 'regulatory-review',
        responsibleFunction: 'data-protection',
        reviewAt: '2027-01-01T00:00:00.000Z',
        targetId: String(operationalInquiryId),
        targetType: 'inquiry',
      },
    )
    expect(placeResponse.status).toBe(200)
    const placed = (await placeResponse.json()) as { holdId: string }
    expect(placed).toEqual({ holdId: expect.any(String) })
    const releaseResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/legal-holds/release',
      operatorToken,
      { holdId: placed.holdId },
    )
    expect(releaseResponse.status).toBe(200)
    await expect(releaseResponse.json()).resolves.toEqual({ released: true })

    const successfulHardDelete = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/content/hard-delete',
      operatorToken,
      {
        inquiryId: String(operationalInquiryId),
        reasonCategory: 'authorized-erasure',
        targetId: messageId,
        targetType: 'message',
      },
    )
    expect(successfulHardDelete.status).toBe(200)
    await expect(successfulHardDelete.json()).resolves.toEqual({ deleted: true, replayed: false })
    await expect(
      payload.findByID({ collection: 'inquiryMessages', depth: 0, id: messageId, overrideAccess: true }),
    ).resolves.toMatchObject({ contentState: 'hard-deleted', text: null })

    const recoveryResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/pending-deletes/recover',
      operatorToken,
      { limit: 25 },
    )
    expect(recoveryResponse.status).toBe(200)
    expect(recoveryResponse.headers.get('cache-control')).toBe('private, no-store')
    await expect(recoveryResponse.json()).resolves.toEqual({ examined: 0, failed: 0, finalized: 0 })

    const anonymizeResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/anonymize',
      operatorToken,
      { inquiryId: String(inquiryId), reasonCategory: 'authorized-erasure' },
    )
    expect(anonymizeResponse.status).toBe(200)
    await expect(anonymizeResponse.json()).resolves.toEqual({ anonymized: true, replayed: false })
    await expect(
      payload.findByID({ collection: 'patientClinicInquiries', depth: 0, id: inquiryId, overrideAccess: true }),
    ).resolves.toMatchObject({ email: null, patient: null, retentionState: 'anonymized' })

    const packageDeleteResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/hard-delete',
      operatorToken,
      { inquiryId: String(operationalInquiryId), reasonCategory: 'authorized-erasure' },
    )
    expect(packageDeleteResponse.status).toBe(200)
    await expect(packageDeleteResponse.json()).resolves.toEqual({ deleted: true, replayed: false })
    await expect(
      payload.findByID({
        collection: 'patientClinicInquiries',
        depth: 0,
        id: operationalInquiryId,
        overrideAccess: true,
      }),
    ).resolves.toMatchObject({ message: null, patient: null, retentionState: 'hard-deleted' })

    const hardDeleteResponse = await requestRegisteredPayloadEndpoint(
      '/api/platform/inquiry-retention/content/hard-delete',
      operatorToken,
      {
        inquiryId: String(inquiryId),
        reasonCategory: 'authorized-erasure',
        targetId: 'missing-synthetic-message',
        targetType: 'message',
      },
    )
    expect(hardDeleteResponse.status).toBe(404)
    expect(hardDeleteResponse.headers.get('cache-control')).toBe('private, no-store')
    await expect(hardDeleteResponse.json()).resolves.toEqual({ error: { code: 'RETENTION_NOT_FOUND' } })
  })
})
