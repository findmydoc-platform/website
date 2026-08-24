import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, handleEndpoints, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import { createVerifiedPatientInquiry, submitGuestClinicInquiry } from '@/features/inquiryCommunication/service'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import { asPayloadPatientUser, cleanupTrackedUsers, createPatientTestUser } from '../fixtures/testUsers'

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
                app_metadata: { user_type: 'patient' },
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

const requestPatientEndpoint = (
  path: string,
  token: string,
  options?: { body?: unknown; method?: 'GET' | 'PATCH' | 'POST' | 'PUT' },
): Promise<Response> =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, 'https://patient-inquiry-boundary.test'), {
      body: typeof options?.body === 'undefined' ? undefined : JSON.stringify(options.body),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(typeof options?.body === 'undefined' ? {} : { 'Content-Type': 'application/json' }),
      },
      method: options?.method ?? 'GET',
    }),
  })

describe('patient inquiry registered Payload HTTP boundary', () => {
  let payload: Payload
  let clinicId: number
  let inquiryId: string
  let foreignInquiryId: string
  let guestInquiryId: string
  let initialRevision: number
  const patientToken = 'synthetic-patient-http-token'
  const foreignPatientToken = 'synthetic-foreign-patient-http-token'
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const slugPrefix = testSlug('patientInquiries.http.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the patient inquiry HTTP test.')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
      overrideAccess: true,
    })

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
      supabaseUserId: `${slugPrefix}-patient-subject`,
    })
    const foreignPatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-foreign-patient`,
      firstName: 'Foreign',
      lastName: 'Patient',
      supabaseUserId: `${slugPrefix}-foreign-patient-subject`,
    })
    if (!patient.email || !patient.supabaseUserId || !foreignPatient.email || !foreignPatient.supabaseUserId) {
      throw new Error('Expected synthetic patient bearer identity fields.')
    }
    syntheticBearerUsers.set(patientToken, {
      email: patient.email,
      firstName: 'Synthetic',
      lastName: 'Patient',
      subject: patient.supabaseUserId,
    })
    syntheticBearerUsers.set(foreignPatientToken, {
      email: foreignPatient.email,
      firstName: 'Foreign',
      lastName: 'Patient',
      subject: foreignPatient.supabaseUserId,
    })

    const patientReq: PayloadRequest = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(fixture.doctor.id),
      email: patient.email,
      fullName: 'Synthetic Patient',
      idempotencyKey: `${slugPrefix}-create`,
      message: 'Synthetic patient inquiry for the registered HTTP boundary.',
      phoneNumber: '+493000000081',
      treatmentTimeline: 'within_two_weeks',
    })
    inquiryId = created.inquiry.id
    initialRevision = created.inquiry.revision
    createdInquiryIds.push(inquiryId)

    const foreignReq: PayloadRequest = await createLocalReq({}, payload)
    foreignReq.user = asPayloadPatientUser(foreignPatient)
    const foreignCreated = await createVerifiedPatientInquiry(foreignReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(fixture.doctor.id),
      email: foreignPatient.email,
      fullName: 'Foreign Synthetic Patient',
      idempotencyKey: `${slugPrefix}-foreign-create`,
      message: 'Synthetic inquiry owned by another patient.',
      phoneNumber: '+493000000082',
      treatmentTimeline: 'flexible',
    })
    foreignInquiryId = foreignCreated.inquiry.id
    createdInquiryIds.push(foreignInquiryId)

    const guestReq: PayloadRequest = await createLocalReq({}, payload)
    const guest = await submitGuestClinicInquiry(guestReq, {
      clinicId,
      consent: true,
      doctorId: fixture.doctor.id,
      email: `${slugPrefix}-guest@example.com`,
      fullName: 'Synthetic Guest',
      message: 'Synthetic guest inquiry without a patient conversation.',
      phoneNumber: '+493000000083',
      treatmentTimeline: 'within_one_month',
    })
    guestInquiryId = guest.id
    createdInquiryIds.push(guestInquiryId)
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
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds })
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: clinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
  }, 60_000)

  it('serves only the authenticated patient own bound inquiry with private live responses', async () => {
    const queueResponse = await requestPatientEndpoint('/api/patient/inquiries?lifecycle=all&limit=20', patientToken)
    expect(queueResponse.status).toBe(200)
    expect(queueResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(queueResponse.headers.get('expires')).toBe('0')
    expect(queueResponse.headers.get('pragma')).toBe('no-cache')
    expect(queueResponse.headers.get('vary')).toContain('Authorization')
    expect(queueResponse.headers.get('vary')).toContain('Cookie')
    const queue = (await queueResponse.json()) as { items: Array<{ id: string }> }
    expect(queue.items.map((item) => item.id)).toEqual([inquiryId])
    expect(queue.items.map((item) => item.id)).not.toContain(foreignInquiryId)
    expect(queue.items.map((item) => item.id)).not.toContain(guestInquiryId)

    const detailResponse = await requestPatientEndpoint(
      `/api/patient/inquiries/detail?inquiryId=${encodeURIComponent(inquiryId)}`,
      patientToken,
    )
    expect(detailResponse.status).toBe(200)
    await expect(detailResponse.json()).resolves.toMatchObject({ inquiry: { id: inquiryId } })
  })

  it('persists a patient reply through the registered message route', async () => {
    const response = await requestPatientEndpoint('/api/patient/inquiries/messages', patientToken, {
      body: {
        expectedRevision: initialRevision,
        idempotencyKey: `${slugPrefix}-patient-http-message`,
        inquiryId,
        text: 'Synthetic patient reply through the registered HTTP route.',
      },
      method: 'POST',
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({
      inquiry: {
        id: inquiryId,
        timeline: expect.arrayContaining([
          expect.objectContaining({
            kind: 'external-message',
            text: 'Synthetic patient reply through the registered HTTP route.',
          }),
        ]),
      },
      replayed: false,
    })

    const messages = await payload.find({
      collection: 'inquiryMessages',
      depth: 0,
      limit: 10,
      overrideAccess: true,
      where: { inquiry: { equals: inquiryId } },
    })
    expect(messages.docs).toHaveLength(1)
  })

  it('keeps foreign and missing detail indistinguishable and rejects an invalid session', async () => {
    const foreign = await requestPatientEndpoint(
      `/api/patient/inquiries/detail?inquiryId=${encodeURIComponent(inquiryId)}`,
      foreignPatientToken,
    )
    const missing = await requestPatientEndpoint(
      '/api/patient/inquiries/detail?inquiryId=missing-inquiry',
      patientToken,
    )
    const invalidSession = await requestPatientEndpoint('/api/patient/inquiries', 'invalid-token')

    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
    await expect(foreign.json()).resolves.toEqual({ error: { code: 'INQUIRY_NOT_FOUND' } })
    await expect(missing.json()).resolves.toEqual({ error: { code: 'INQUIRY_NOT_FOUND' } })
    expect(invalidSession.status).toBe(401)
    await expect(invalidSession.json()).resolves.toEqual({ error: { code: 'INQUIRY_UNAUTHORIZED' } })
  })

  it('does not route an unregistered method to the patient queue handler', async () => {
    const response = await requestPatientEndpoint('/api/patient/inquiries', patientToken, {
      body: {},
      method: 'POST',
    })

    expect(response.status).toBe(404)
  })
})
