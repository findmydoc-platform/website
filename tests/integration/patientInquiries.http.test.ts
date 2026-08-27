import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createLocalReq, getPayload, handleEndpoints, type Payload, type PayloadRequest } from 'payload'

import config from '@payload-config'
import {
  createVerifiedPatientInquiry,
  readClinicInquiryQueue,
  submitGuestClinicInquiry,
} from '@/features/inquiryCommunication/service'
import { createClinicFixture } from '../fixtures/createClinicFixture'
import { ensureBaseline } from '../fixtures/ensureBaseline'
import { testSlug } from '../fixtures/testSlug'
import {
  asClinicScopedPayloadUser,
  asPayloadPatientUser,
  cleanupTrackedUsers,
  createClinicTestUser,
  createPatientTestUser,
  type PayloadRequestUser,
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
  let doctorId: number | string
  let clinicStaffUser: PayloadRequestUser
  let inquiryId: string
  let foreignInquiryId: string
  let guestInquiryId: string
  let initialRevision: number
  const patientToken = 'synthetic-patient-http-token'
  const foreignPatientToken = 'synthetic-foreign-patient-http-token'
  const creationPatientToken = 'synthetic-creation-patient-http-token'
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('patientInquiries.http.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the patient inquiry HTTP test.')

    const fixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = fixture.clinic.id
    doctorId = fixture.doctor.id
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
    const creationPatient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-creation-patient`,
      firstName: 'Account',
      lastName: 'Bound',
      supabaseUserId: `${slugPrefix}-creation-patient-subject`,
    })
    const clinicStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-clinic-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinic Staff',
      supabaseUserId: `${slugPrefix}-clinic-staff-subject`,
    })
    clinicStaffUser = await asClinicScopedPayloadUser(payload, clinicStaff, clinicId)
    if (
      !patient.email ||
      !patient.supabaseUserId ||
      !foreignPatient.email ||
      !foreignPatient.supabaseUserId ||
      !creationPatient.email ||
      !creationPatient.supabaseUserId
    ) {
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
    syntheticBearerUsers.set(creationPatientToken, {
      email: creationPatient.email,
      firstName: 'Account',
      lastName: 'Bound',
      subject: creationPatient.supabaseUserId,
    })

    const patientReq: PayloadRequest = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
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
      doctorId: String(doctorId),
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
      doctorId,
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
    await cleanupTrackedUsers(payload, { patientIds: createdPatientIds, staffIds: createdStaffIds })
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

  it('creates an account-bound inquiry through the real Supabase auth seam and exposes it to both participants', async () => {
    const body = {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-authenticated-create`,
      message: 'Synthetic inquiry submitted through the clinic form contract.',
      phoneNumber: '+493000000091',
      treatmentTimeline: 'within_two_weeks',
    }

    const response = await requestPatientEndpoint('/api/patient/inquiries', creationPatientToken, {
      body,
      method: 'POST',
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    const result = (await response.json()) as { inquiry: { id: string }; replayed: boolean }
    expect(result).toMatchObject({ inquiry: { id: expect.any(String) }, replayed: false })
    createdInquiryIds.push(result.inquiry.id)

    const stored = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: result.inquiry.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(stored).toMatchObject({
      consent: {
        accepted: true,
        text: 'I agree that findmydoc may process my contact details and request context to coordinate follow-up.',
      },
      email: `${slugPrefix}-creation-patient@example.com`,
      fullName: 'Account Bound',
      phoneNumber: '+493000000091',
      patient: expect.anything(),
    })

    const storedPatientId = typeof stored.patient === 'object' && stored.patient ? stored.patient.id : stored.patient
    if (typeof storedPatientId !== 'string' && typeof storedPatientId !== 'number') {
      throw new Error('Expected the authenticated inquiry to retain its patient binding.')
    }
    const patient = await payload.findByID({
      collection: 'patients',
      id: storedPatientId,
      depth: 0,
      overrideAccess: true,
    })
    expect(patient).toMatchObject({
      email: `${slugPrefix}-creation-patient@example.com`,
      firstName: 'Account',
      lastName: 'Bound',
      phoneNumber: '+493000000091',
    })

    for (const collection of ['inquiryConversations', 'inquiryReadPositions'] as const) {
      const related = await payload.find({
        collection,
        depth: 0,
        overrideAccess: true,
        pagination: false,
        where: { inquiry: { equals: result.inquiry.id } },
      })
      expect(related.docs).toHaveLength(1)
    }

    const patientQueue = await requestPatientEndpoint(
      '/api/patient/inquiries?lifecycle=all&limit=50',
      creationPatientToken,
    )
    expect(patientQueue.status).toBe(200)
    await expect(patientQueue.json()).resolves.toMatchObject({
      items: expect.arrayContaining([expect.objectContaining({ id: result.inquiry.id })]),
    })

    const clinicReq: PayloadRequest = await createLocalReq({}, payload)
    clinicReq.user = clinicStaffUser
    const clinicQueue = await readClinicInquiryQueue(clinicReq, { lifecycle: 'all', limit: 50, unreadOnly: false })
    expect(clinicQueue.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: result.inquiry.id })]))

    const attemptedPhoneOverride = await requestPatientEndpoint('/api/patient/inquiries', creationPatientToken, {
      body: {
        ...body,
        idempotencyKey: `${slugPrefix}-authenticated-create-phone-override`,
        phoneNumber: '+493099999999',
      },
      method: 'POST',
    })
    expect(attemptedPhoneOverride.status).toBe(201)
    const overrideResult = (await attemptedPhoneOverride.json()) as { inquiry: { id: string } }
    createdInquiryIds.push(overrideResult.inquiry.id)
    const overrideInquiry = await payload.findByID({
      collection: 'patientClinicInquiries',
      id: overrideResult.inquiry.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(overrideInquiry.phoneNumber).toBe('+493000000091')
  })

  it('rejects browser-controlled identity and an expired Supabase session without persisting an inquiry', async () => {
    const baseBody = {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(doctorId),
      idempotencyKey: `${slugPrefix}-rejected-create`,
      message: 'Synthetic rejected inquiry.',
      phoneNumber: '+493000000092',
    }
    const countBefore = await payload.count({ collection: 'patientClinicInquiries', overrideAccess: true })

    for (const injectedIdentity of [
      { actorId: 'attacker' },
      { patientId: 'attacker' },
      { email: 'attacker@example.com' },
      { fullName: 'Browser Controlled' },
    ]) {
      const response = await requestPatientEndpoint('/api/patient/inquiries', creationPatientToken, {
        body: { ...baseBody, ...injectedIdentity },
        method: 'POST',
      })
      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: { code: 'INQUIRY_INVALID_INPUT' } })
    }

    const expired = await requestPatientEndpoint('/api/patient/inquiries', 'expired-patient-token', {
      body: baseBody,
      method: 'POST',
    })
    expect(expired.status).toBe(401)
    await expect(expired.json()).resolves.toEqual({ error: { code: 'INQUIRY_UNAUTHORIZED' } })
    const countAfter = await payload.count({ collection: 'patientClinicInquiries', overrideAccess: true })
    expect(countAfter.totalDocs).toBe(countBefore.totalDocs)
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
})
