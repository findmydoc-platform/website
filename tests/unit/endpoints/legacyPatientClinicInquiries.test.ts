import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  legacyPatientClinicInquiryGetHandler,
  legacyPatientClinicInquiryPatchHandler,
  legacyPatientClinicInquiriesGetHandler,
} from '@/endpoints/legacyPatientClinicInquiries'
import { InquiryCommunicationServiceError } from '@/features/inquiryCommunication/service'

const mocks = vi.hoisted(() => ({
  bearer: vi.fn(),
  bootstrap: vi.fn(),
  changeStatus: vi.fn(),
  readDetail: vi.fn(),
  readQueue: vi.fn(),
}))

vi.mock('@/auth/utilities/jwtValidation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/auth/utilities/jwtValidation')>()),
  validateSupabaseBearerToken: mocks.bearer,
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.bootstrap,
}))

vi.mock('@/features/inquiryCommunication/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/inquiryCommunication/service')>()),
  changeLegacyClinicInquiryStatus: mocks.changeStatus,
  readLegacyClinicInquiryDetail: mocks.readDetail,
  readLegacyClinicInquiryQueue: mocks.readQueue,
}))

const legacyInquiry = {
  createdAt: '2026-08-24T10:00:00.000Z',
  email: 'patient@example.invalid',
  fullName: 'Synthetic Patient',
  id: 'inquiry-1',
  message: 'Synthetic request',
  phoneNumber: '+49 000 0000',
  preferredContactWindow: 'morning' as const,
  status: 'submitted' as const,
  treatment: { id: 'treatment-1', name: 'Synthetic treatment' },
  treatmentTimeline: 'within_two_weeks' as const,
  updatedAt: '2026-08-24T10:00:00.000Z',
}

const request = ({
  body,
  contract,
  id,
  search = '',
  subject = 'supabase-staff-1',
}: {
  body?: unknown
  contract?: string | readonly string[]
  id?: string
  search?: string
  subject?: string
} = {}): PayloadRequest => {
  const headers = new Headers({ authorization: 'Bearer clinic-token' })
  for (const value of typeof contract === 'string' ? [contract] : (contract ?? [])) {
    headers.append('X-Findmydoc-Clinic-Dashboard-Contract', value)
  }

  return {
    context: {},
    headers,
    json: vi.fn(async () => body),
    payload: {
      logger: {
        debug: vi.fn(),
        error: vi.fn(),
        fatal: vi.fn(),
        info: vi.fn(),
        level: 'info',
        trace: vi.fn(),
        warn: vi.fn(),
      },
    },
    routeParams: id ? { id } : {},
    searchParams: new URLSearchParams(search),
    user: {
      id: 'staff-1',
      collection: 'clinicStaff',
      supabaseUserId: subject,
    },
  } as unknown as PayloadRequest
}

const readResponse = async (response: Response) => ({ body: await response.json(), status: response.status })

describe('legacy PatientClinicInquiries bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bearer.mockResolvedValue({
      status: 'authenticated',
      authData: {
        supabaseUserId: 'supabase-staff-1',
        userEmail: 'staff@example.invalid',
        userType: 'clinic',
      },
    })
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        capabilities: [
          'clinic-profile:view',
          'clinic-profile:edit',
          'clinic-treatments:view',
          'clinic-treatments:edit',
          'clinic-gallery:view',
          'clinic-gallery:edit',
        ],
        clinic: { id: 'clinic-1', name: 'Synthetic Clinic' },
        principal: { id: 'staff-1' },
        status: 'approved',
      },
    })
    mocks.readQueue.mockResolvedValue({ docs: [legacyInquiry] })
    mocks.readDetail.mockResolvedValue(legacyInquiry)
    mocks.changeStatus.mockResolvedValue({ ...legacyInquiry, status: 'in_review' })
  })

  it('serves only the exact historical list query and DTO', async () => {
    const req = request({ search: 'depth=1&limit=100&sort=-createdAt' })

    const response = await legacyPatientClinicInquiriesGetHandler(req)

    expect(await readResponse(response)).toEqual({ status: 200, body: { docs: [legacyInquiry] } })
    expect(mocks.readQueue).toHaveBeenCalledWith(req)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, X-Findmydoc-Clinic-Dashboard-Contract')
  })

  it.each([
    ['missing required query', 'depth=1&limit=100'],
    ['expanded limit', 'depth=1&limit=101&sort=-createdAt'],
    ['unknown query', 'depth=1&limit=100&sort=-createdAt&where[clinic][equals]=other'],
    ['duplicate query', 'depth=1&depth=1&limit=100&sort=-createdAt'],
  ])('rejects an invalid list request: %s', async (_case, search) => {
    const response = await legacyPatientClinicInquiriesGetHandler(request({ search }))

    expect(response.status).toBe(400)
    expect(mocks.readQueue).not.toHaveBeenCalled()
  })

  it('serves one tenant-scoped legacy DTO without generic Payload wrapping', async () => {
    const req = request({ id: 'inquiry-1' })

    const response = await legacyPatientClinicInquiryGetHandler(req)

    expect(await readResponse(response)).toEqual({ status: 200, body: legacyInquiry })
    expect(mocks.readDetail).toHaveBeenCalledWith(req, { inquiryId: 'inquiry-1' })
  })

  it.each([
    ['inquiry contract', 'inquiry-communication-v1'],
    ['unknown contract', 'unknown-contract'],
    ['duplicate contract', ['inquiry-communication-v1', 'inquiry-communication-v1']],
  ] as const)('rejects the %s before auth or domain work', async (_case, contract) => {
    const responses = await Promise.all([
      legacyPatientClinicInquiriesGetHandler(request({ contract, search: 'depth=1&limit=100&sort=-createdAt' })),
      legacyPatientClinicInquiryGetHandler(request({ contract, id: 'inquiry-1' })),
      legacyPatientClinicInquiryPatchHandler(request({ body: { status: 'in_review' }, contract, id: 'inquiry-1' })),
    ])

    expect(responses.map((response) => response.status)).toEqual([400, 400, 400])
    expect(mocks.bearer).not.toHaveBeenCalled()
    expect(mocks.bootstrap).not.toHaveBeenCalled()
    expect(mocks.readQueue).not.toHaveBeenCalled()
    expect(mocks.readDetail).not.toHaveBeenCalled()
    expect(mocks.changeStatus).not.toHaveBeenCalled()
  })

  it('accepts only the historical strict status body and returns Payload-compatible doc wrapping', async () => {
    const req = request({ body: { status: 'in_review' }, id: 'inquiry-1' })

    const response = await legacyPatientClinicInquiryPatchHandler(req)

    expect(await readResponse(response)).toEqual({
      status: 200,
      body: { doc: { ...legacyInquiry, status: 'in_review' } },
    })
    expect(mocks.changeStatus).toHaveBeenCalledWith(req, {
      inquiryId: 'inquiry-1',
      status: 'in_review',
    })

    const expanded = await legacyPatientClinicInquiryPatchHandler(
      request({ body: { expectedRevision: 1, status: 'contacted' }, id: 'inquiry-1' }),
    )
    expect(expanded.status).toBe(400)
    expect(mocks.changeStatus).toHaveBeenCalledOnce()
  })

  it.each(['conflict', 'invalid-state'] as const)(
    'maps a domain %s to the historical conflict status',
    async (kind) => {
      mocks.changeStatus.mockRejectedValueOnce(new InquiryCommunicationServiceError(kind, 'private state'))

      const response = await legacyPatientClinicInquiryPatchHandler(
        request({ body: { status: 'in_review' }, id: 'inquiry-1' }),
      )

      expect(response.status).toBe(409)
      await expect(response.json()).resolves.toEqual({ errors: [{ message: 'Inquiry status conflict.' }] })
    },
  )

  it('revalidates the Bearer subject before reading a tenant', async () => {
    const response = await legacyPatientClinicInquiriesGetHandler(
      request({ search: 'depth=1&limit=100&sort=-createdAt', subject: 'other-subject' }),
    )

    expect(response.status).toBe(401)
    expect(mocks.readQueue).not.toHaveBeenCalled()
  })
})
