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
const afterMock = vi.hoisted(() => vi.fn())

vi.mock('next/server.js', () => ({ after: afterMock }))

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

const CONTRACT_HEADER = 'X-Findmydoc-Clinic-Dashboard-Contract'
const CONTRACT_VERSION = 'inquiry-communication-v2'

const requestRegisteredPayloadEndpoint = (
  path: string,
  token: string,
  options?: { body?: unknown; method?: 'GET' | 'PATCH' | 'POST' | 'PUT' },
): Promise<Response> =>
  handleEndpoints({
    config,
    request: new Request(new URL(path, 'https://payload-http-boundary.test'), {
      body: typeof options?.body === 'undefined' ? undefined : JSON.stringify(options.body),
      headers: {
        Authorization: `Bearer ${token}`,
        [CONTRACT_HEADER]: CONTRACT_VERSION,
        ...(typeof options?.body === 'undefined' ? {} : { 'Content-Type': 'application/json' }),
      },
      method: options?.method ?? 'GET',
    }),
  })

describe('inquiry communication registered Payload HTTP boundary', () => {
  let payload: Payload
  let clinicId: number
  let foreignClinicId: number
  let patientReq: PayloadRequest
  let inquiryId: string
  const clinicToken = 'synthetic-clinic-http-token'
  const foreignClinicToken = 'synthetic-foreign-clinic-http-token'
  const createdInquiryIds: Array<number | string> = []
  const createdPatientIds: Array<number | string> = []
  const createdStaffIds: Array<number | string> = []
  const slugPrefix = testSlug('inquiryCommunication.http.test.ts')

  beforeAll(async () => {
    payload = await getPayload({ config })
    await ensureBaseline(payload)
    const city = (await payload.find({ collection: 'cities', depth: 0, limit: 1, overrideAccess: true })).docs[0]
    if (!city) throw new Error('Expected a baseline city for the registered HTTP boundary test.')

    const localFixture = await createClinicFixture(payload, city.id, { slugPrefix })
    clinicId = localFixture.clinic.id
    await payload.update({
      collection: 'clinics',
      data: { status: 'approved' },
      depth: 0,
      id: clinicId,
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
      emailPrefix: `${slugPrefix}-staff`,
      firstName: 'Synthetic',
      lastName: 'Clinician',
      supabaseUserId: `${slugPrefix}-staff-subject`,
    })
    await asClinicScopedPayloadUser(payload, localStaff, clinicId)
    const localStaffEmail = localStaff.email
    const localStaffSubject = localStaff.supabaseUserId
    if (!localStaffEmail || !localStaffSubject) {
      throw new Error('Expected synthetic local staff to have an email and Supabase subject.')
    }
    syntheticBearerUsers.set(clinicToken, {
      email: localStaffEmail,
      firstName: 'Synthetic',
      lastName: 'Clinician',
      subject: localStaffSubject,
    })

    const foreignStaff = await createClinicTestUser(payload, {
      createdStaffIds,
      emailPrefix: `${slugPrefix}-foreign-staff`,
      firstName: 'Foreign',
      lastName: 'Clinician',
      supabaseUserId: `${slugPrefix}-foreign-staff-subject`,
    })
    await asClinicScopedPayloadUser(payload, foreignStaff, foreignClinicId)
    const foreignStaffEmail = foreignStaff.email
    const foreignStaffSubject = foreignStaff.supabaseUserId
    if (!foreignStaffEmail || !foreignStaffSubject) {
      throw new Error('Expected synthetic foreign staff to have an email and Supabase subject.')
    }
    syntheticBearerUsers.set(foreignClinicToken, {
      email: foreignStaffEmail,
      firstName: 'Foreign',
      lastName: 'Clinician',
      subject: foreignStaffSubject,
    })

    const patient = await createPatientTestUser(payload, {
      createdPatientIds,
      emailPrefix: `${slugPrefix}-patient`,
      firstName: 'Synthetic',
      lastName: 'Patient',
    })
    patientReq = await createLocalReq({}, payload)
    patientReq.user = asPayloadPatientUser(patient)
    const created = await createVerifiedPatientInquiry(patientReq, {
      clinicId: String(clinicId),
      consent: true,
      doctorId: String(localFixture.doctor.id),
      email: `${slugPrefix}-patient@example.com`,
      fullName: 'Synthetic Patient',
      idempotencyKey: `${slugPrefix}-create`,
      message: 'Synthetic registered HTTP boundary inquiry.',
      phoneNumber: '+493000000011',
      treatmentTimeline: 'within_two_weeks',
    })
    createdInquiryIds.push(created.inquiry.id)
    inquiryId = created.inquiry.id
  }, 60_000)

  afterAll(async () => {
    syntheticBearerUsers.clear()
    for (const collection of [
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
    await payload.delete({
      collection: 'doctors',
      overrideAccess: true,
      trash: true,
      where: { clinic: { equals: foreignClinicId } },
    })
    await payload.delete({ collection: 'clinics', id: clinicId, overrideAccess: true, trash: true })
    await payload.delete({ collection: 'clinics', id: foreignClinicId, overrideAccess: true, trash: true })
  })

  it('routes queue, detail, and mutation through registered methods with private live responses', async () => {
    const queueResponse = await requestRegisteredPayloadEndpoint('/api/clinic-dashboard/inquiries', clinicToken)
    expect(queueResponse.status).toBe(200)
    expect(queueResponse.headers.get('cache-control')).toBe('private, no-store')
    expect(queueResponse.headers.get('expires')).toBe('0')
    expect(queueResponse.headers.get('pragma')).toBe('no-cache')
    expect(queueResponse.headers.get('vary')).toContain('Authorization')
    expect(queueResponse.headers.get('vary')).toContain(CONTRACT_HEADER)
    const queue = (await queueResponse.json()) as { items: Array<{ id: string }> }
    expect(queue.items.map((item) => item.id)).toEqual([inquiryId])

    const detailResponse = await requestRegisteredPayloadEndpoint(
      `/api/clinic-dashboard/inquiries/detail?inquiryId=${encodeURIComponent(inquiryId)}`,
      clinicToken,
    )
    expect(detailResponse.status).toBe(200)
    await expect(detailResponse.json()).resolves.toMatchObject({ inquiry: { id: inquiryId } })

    const mutationResponse = await requestRegisteredPayloadEndpoint(
      '/api/clinic-dashboard/inquiries/notes',
      clinicToken,
      {
        body: {
          idempotencyKey: `${slugPrefix}-http-note`,
          inquiryId,
          text: 'Synthetic note sent through the registered Payload HTTP route.',
        },
        method: 'POST',
      },
    )
    expect(mutationResponse.status).toBe(200)
    await expect(mutationResponse.json()).resolves.toMatchObject({
      inquiry: {
        id: inquiryId,
        timeline: expect.arrayContaining([
          expect.objectContaining({
            kind: 'internal-note',
            text: 'Synthetic note sent through the registered Payload HTTP route.',
          }),
        ]),
      },
      replayed: false,
    })
  })

  it('returns tenant-safe not-found through the registered detail route', async () => {
    const response = await requestRegisteredPayloadEndpoint(
      `/api/clinic-dashboard/inquiries/detail?inquiryId=${encodeURIComponent(inquiryId)}`,
      foreignClinicToken,
    )

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: { code: 'INQUIRY_NOT_FOUND' } })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('does not route an unregistered method to the queue handler', async () => {
    const response = await requestRegisteredPayloadEndpoint('/api/clinic-dashboard/inquiries', clinicToken, {
      body: {},
      method: 'POST',
    })

    expect(response.status).toBe(404)
  })
})
