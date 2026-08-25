import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, handleEndpoints, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import { createVerifiedPatientInquiry } from '@/features/inquiryCommunication/service'
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
  firstName: string
  lastName: string
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
                app_metadata: { user_type: 'clinic' },
                email: user.email,
                id: user.subject,
                user_metadata: { first_name: user.firstName, last_name: user.lastName },
              },
            },
            error: null,
          }
        },
      },
    }),
  }
})

const requestLegacyEndpoint = (
  path: string,
  token: string,
  options?: { body?: unknown; method?: 'DELETE' | 'GET' | 'PATCH' | 'POST' },
): Promise<Response> =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, 'https://legacy-inquiry-boundary.test'), {
      body: typeof options?.body === 'undefined' ? undefined : JSON.stringify(options.body),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(typeof options?.body === 'undefined' ? {} : { 'Content-Type': 'application/json' }),
      },
      method: options?.method ?? 'GET',
    }),
  })

describe('legacy PatientClinicInquiries compatibility bridge', () => {
  let payload: Payload
  let localClinicId: number
  let foreignClinicId: number
  let operationalInquiryId: string
  let foreignInquiryId: string
  let legacyInquiryId: string
  const localToken = 'synthetic-legacy-local-token'
  const foreignToken = 'synthetic-legacy-foreign-token'
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('legacyPatientClinicInquiries.bridge.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the legacy inquiry bridge test.')

    const localFixture = await createClinicFixture(payload, city.id, { slugPrefix })
    localClinicId = localFixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: localClinicId,
      overrideAccess: true,
    })
    const foreignFixture = await createClinicFixture(payload, city.id, {
      clinicIndex: 1,
      doctorIndex: 1,
      slugPrefix: `${slugPrefix}-foreign`,
    })
    foreignClinicId = foreignFixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: foreignClinicId,
      overrideAccess: true,
    })

    const localStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-local-staff`,
      firstName: 'Synthetic',
      lastName: 'Local Clinician',
      supabaseUserId: `${slugPrefix}-local-staff-subject`,
    })
    await asClinicScopedPayloadUser(payload, localStaff, localClinicId)
    if (!localStaff.email || !localStaff.supabaseUserId) {
      throw new Error('Expected the synthetic local clinic user to have bearer identity fields.')
    }
    syntheticBearerUsers.set(localToken, {
      email: localStaff.email,
      firstName: 'Synthetic',
      lastName: 'Local Clinician',
      subject: localStaff.supabaseUserId,
    })

    const foreignStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-foreign-staff`,
      firstName: 'Synthetic',
      lastName: 'Foreign Clinician',
      supabaseUserId: `${slugPrefix}-foreign-staff-subject`,
    })
    await asClinicScopedPayloadUser(payload, foreignStaff, foreignClinicId)
    if (!foreignStaff.email || !foreignStaff.supabaseUserId) {
      throw new Error('Expected the synthetic foreign clinic user to have bearer identity fields.')
    }
    syntheticBearerUsers.set(foreignToken, {
      email: foreignStaff.email,
      firstName: 'Synthetic',
      lastName: 'Foreign Clinician',
      subject: foreignStaff.supabaseUserId,
    })

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Bridge Patient',
    })
    const patientReq: PayloadRequest = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)

    const operational = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(localClinicId),
      consent: true,
      doctorId: String(localFixture.doctor.id),
      idempotencyKey: `${slugPrefix}-operational-create`,
      message: 'Synthetic operational inquiry for the legacy bridge.',
      phoneNumber: '+493000000061',
      preferredContactWindow: 'morning',
      treatmentTimeline: 'within_two_weeks',
    })
    operationalInquiryId = operational.inquiry.id
    createdInquiryIds.push(operationalInquiryId)

    const foreign = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(foreignClinicId),
      consent: true,
      doctorId: String(foreignFixture.doctor.id),
      idempotencyKey: `${slugPrefix}-foreign-create`,
      message: 'Synthetic inquiry owned by the foreign clinic.',
      phoneNumber: '+493000000062',
      treatmentTimeline: 'flexible',
    })
    foreignInquiryId = foreign.inquiry.id
    createdInquiryIds.push(foreignInquiryId)

    const legacy = await payload.create({
      collection: 'patientClinicInquiries',
      context: { inquiryCommunicationCommand: true },
      data: {
        clinic: localClinicId,
        consent: {
          accepted: true,
          acceptedAt: '2026-08-24T10:00:00.000Z',
          text: 'Synthetic legacy compatibility consent.',
        },
        email: `${slugPrefix}-legacy@example.com`,
        fullName: 'Synthetic Legacy Patient',
        message: 'Synthetic pre-cutover legacy inquiry.',
        phoneNumber: '+493000000063',
        status: 'submitted',
        treatmentTimeline: 'within_one_month',
      },
      depth: 0,
      overrideAccess: true,
    })
    legacyInquiryId = String(legacy.id)
    createdInquiryIds.push(legacy.id)
  }, 60_000)

  afterAll(async () => {
    syntheticBearerUsers.clear()
    if (!payload) return
    for (const collection of [
      'inquiryAuditEvents',
      'inquiryReadPositions',
      'inquiryMessages',
      'inquiryInternalNotes',
      'inquiryAttachments',
      'inquiryConversations',
    ] as const) {
      await payload.delete({
        collection,
        overrideAccess: true,
        trash: true,
        where: { inquiry: { in: createdInquiryIds } },
      })
    }
    for (const id of createdInquiryIds) {
      await payload.delete({ collection: 'patientClinicInquiries', id, overrideAccess: true, trash: true })
    }
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { in: [localClinicId, foreignClinicId] } },
    })
    await payload.delete({ collection: 'clinics', id: localClinicId, overrideAccess: true, trash: true })
    await payload.delete({ collection: 'clinics', id: foreignClinicId, overrideAccess: true, trash: true })
  }, 60_000)

  it('serves the exact old list and detail paths with server-derived tenant scope', async () => {
    const localListResponse = await requestLegacyEndpoint(
      '/api/patientClinicInquiries?depth=1&limit=100&sort=-createdAt',
      localToken,
    )
    expect(localListResponse.status).toBe(200)
    expect(localListResponse.headers.get('cache-control')).toBe('private, no-store')
    const localList = (await localListResponse.json()) as { docs: Array<Record<string, unknown>> }
    expect(localList.docs.map((doc) => doc.id)).toEqual(expect.arrayContaining([operationalInquiryId, legacyInquiryId]))
    expect(localList.docs.map((doc) => doc.id)).not.toContain(foreignInquiryId)

    const operationalProjection = localList.docs.find((doc) => doc.id === operationalInquiryId)
    expect(operationalProjection).toBeDefined()
    expect(Object.keys(operationalProjection ?? {}).sort()).toEqual(
      [
        'createdAt',
        'email',
        'fullName',
        'id',
        'message',
        'phoneNumber',
        'preferredContactWindow',
        'status',
        'treatment',
        'treatmentTimeline',
        'updatedAt',
      ].sort(),
    )
    expect(operationalProjection).toMatchObject({
      email: `${slugPrefix}-patient@example.com`,
      fullName: 'Synthetic Bridge Patient',
      id: operationalInquiryId,
      status: 'submitted',
    })

    const ownDetailResponse = await requestLegacyEndpoint(
      `/api/patientClinicInquiries/${encodeURIComponent(operationalInquiryId)}`,
      localToken,
    )
    expect(ownDetailResponse.status).toBe(200)
    await expect(ownDetailResponse.json()).resolves.toEqual(operationalProjection)

    const foreignDetailResponse = await requestLegacyEndpoint(
      `/api/patientClinicInquiries/${encodeURIComponent(operationalInquiryId)}`,
      foreignToken,
    )
    expect(foreignDetailResponse.status).toBe(404)
    await expect(foreignDetailResponse.json()).resolves.toEqual({ errors: [{ message: 'Inquiry not found.' }] })

    const foreignListResponse = await requestLegacyEndpoint(
      '/api/patientClinicInquiries?depth=1&limit=100&sort=-createdAt',
      foreignToken,
    )
    expect(foreignListResponse.status).toBe(200)
    const foreignList = (await foreignListResponse.json()) as { docs: Array<{ id: string }> }
    expect(foreignList.docs.map((doc) => doc.id)).toContain(foreignInquiryId)
    expect(foreignList.docs.map((doc) => doc.id)).not.toContain(operationalInquiryId)
    expect(foreignList.docs.map((doc) => doc.id)).not.toContain(legacyInquiryId)
  })

  it('serializes an old-client forward transition and writes only content-free audit metadata', async () => {
    const foreignMutation = await requestLegacyEndpoint(
      `/api/patientClinicInquiries/${encodeURIComponent(operationalInquiryId)}`,
      foreignToken,
      { body: { status: 'in_review' }, method: 'PATCH' },
    )
    expect(foreignMutation.status).toBe(404)

    const response = await requestLegacyEndpoint(
      `/api/patientClinicInquiries/${encodeURIComponent(operationalInquiryId)}`,
      localToken,
      { body: { status: 'in_review' }, method: 'PATCH' },
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      doc: { id: operationalInquiryId, status: 'in_review' },
    })

    const stored = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: operationalInquiryId,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({
      activitySequence: 2,
      handlingStatus: 'in_review',
      lifecycle: 'open',
      revision: 1,
      status: 'submitted',
    })

    const statusAudits = await payload.find({
      collection: 'inquiryAuditEvents',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: {
        and: [{ inquiry: { equals: operationalInquiryId } }, { eventType: { equals: 'handling-status-changed' } }],
      },
    })
    expect(statusAudits.docs).toHaveLength(1)
    const audit = statusAudits.docs[0]
    expect(audit).toMatchObject({
      actorKind: 'clinic',
      eventType: 'handling-status-changed',
      fromValue: 'submitted',
      sequence: 2,
      targetId: operationalInquiryId,
      targetType: 'inquiry',
      toValue: 'in_review',
    })
    expect(audit?.reason).toBeNull()
    for (const contentField of ['email', 'fullName', 'message', 'phoneNumber', 'text']) {
      expect(audit).not.toHaveProperty(contentField)
    }
  })

  it('keeps a pre-cutover legacy row immutable through the old status path', async () => {
    const response = await requestLegacyEndpoint(
      `/api/patientClinicInquiries/${encodeURIComponent(legacyInquiryId)}`,
      localToken,
      { body: { status: 'in_review' }, method: 'PATCH' },
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ errors: [{ message: 'Inquiry status conflict.' }] })
    const stored = await payload.findByID({
      collection: 'patientClinicInquiries',
      depth: 0,
      id: legacyInquiryId,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({
      activitySequence: null,
      handlingStatus: null,
      lifecycle: null,
      revision: null,
      status: 'submitted',
    })
    const audits = await payload.find({
      collection: 'inquiryAuditEvents',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { inquiry: { equals: legacyInquiryId } },
    })
    expect(audits.docs).toHaveLength(0)
  })

  it('keeps generic collection REST mutations closed', async () => {
    const blockedEmail = `${slugPrefix}-blocked-generic-create@example.com`
    const response = await requestLegacyEndpoint('/api/patientClinicInquiries', localToken, {
      body: {
        clinic: localClinicId,
        consent: {
          accepted: true,
          acceptedAt: '2026-08-24T10:00:00.000Z',
          text: 'Synthetic blocked generic REST consent.',
        },
        email: blockedEmail,
        fullName: 'Blocked Generic REST Patient',
        message: 'This generic create must remain closed.',
        phoneNumber: '+493000000064',
        status: 'submitted',
      },
      method: 'POST',
    })

    expect(response.status).toBe(403)
    const persisted = await payload.count({
      collection: 'patientClinicInquiries',
      overrideAccess: true,
      where: { email: { equals: blockedEmail } },
    })
    expect(persisted.totalDocs).toBe(0)
  })
})
