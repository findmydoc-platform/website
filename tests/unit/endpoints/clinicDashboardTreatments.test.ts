import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clinicDashboardTreatmentsGetHandler,
  clinicDashboardTreatmentsPatchHandler,
  clinicDashboardTreatmentsPostHandler,
} from '@/endpoints/clinicDashboardTreatments'
import { ClinicTreatmentServiceError } from '@/features/clinicDashboard/treatments/service'

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.bootstrap,
}))

vi.mock('@/features/clinicDashboard/treatments/service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/clinicDashboard/treatments/service')>()
  return {
    ...original,
    createClinicTreatment: mocks.create,
    readClinicTreatmentSnapshot: mocks.read,
    updateClinicTreatment: mocks.update,
  }
})

const offering = {
  active: false,
  id: 'offering-1',
  priceEUR: 100,
  revision: '2026-08-13T10:00:00.000Z',
  treatment: { descriptionText: 'Description', id: 'treatment-1', name: 'Treatment' },
}

const request = (body?: unknown) =>
  ({
    headers: new Headers({ authorization: 'Bearer token' }),
    json: vi.fn(async () => body),
    payload: { logger: { error: vi.fn() } },
  }) as unknown as PayloadRequest

describe('Clinic Dashboard treatment endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        capabilities: [
          'clinic-profile:view',
          'clinic-profile:edit',
          'clinic-treatments:view',
          'clinic-treatments:edit',
        ],
        clinic: { id: '42', name: 'Assigned clinic' },
      },
    })
    mocks.read.mockResolvedValue({ catalogue: [offering.treatment], offerings: [offering] })
    mocks.create.mockResolvedValue(offering)
    mocks.update.mockResolvedValue({ ...offering, active: true })
  })

  it('returns only the server-assigned clinic snapshot with private-live headers', async () => {
    const response = await clinicDashboardTreatmentsGetHandler(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, X-Findmydoc-Clinic-Dashboard-Contract')
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), '42')
  })

  it('creates a treatment inactive without accepting caller-controlled active state', async () => {
    const response = await clinicDashboardTreatmentsPostHandler(request({ priceEUR: 100, treatmentId: 'treatment-1' }))

    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), '42', {
      priceEUR: 100,
      treatmentId: 'treatment-1',
    })

    const rejected = await clinicDashboardTreatmentsPostHandler(
      request({ active: true, priceEUR: 100, treatmentId: 'treatment-1' }),
    )
    expect(rejected.status).toBe(400)
    expect(mocks.create).toHaveBeenCalledOnce()
  })

  it('requires an expected revision for updates and maps conflicts to 409', async () => {
    const input = {
      active: true,
      expectedRevision: offering.revision,
      offeringId: offering.id,
      priceEUR: 120,
    }
    const response = await clinicDashboardTreatmentsPatchHandler(request(input))
    expect(response.status).toBe(200)
    expect(mocks.update).toHaveBeenCalledWith(expect.anything(), '42', input)

    mocks.update.mockRejectedValueOnce(new ClinicTreatmentServiceError('conflict', 'changed'))
    const conflict = await clinicDashboardTreatmentsPatchHandler(request(input))
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({ error: { code: 'CLINIC_TREATMENT_CONFLICT' } })
  })

  it('reuses bootstrap authorization failures without calling the service', async () => {
    mocks.bootstrap.mockResolvedValue({ status: 'access-denied' })
    const response = await clinicDashboardTreatmentsGetHandler(request())

    expect(response.status).toBe(403)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  it('requires the method-specific treatment capability', async () => {
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        capabilities: ['clinic-treatments:view'],
        clinic: { id: '42', name: 'Assigned clinic' },
      },
    })

    expect((await clinicDashboardTreatmentsGetHandler(request())).status).toBe(200)
    expect(
      (await clinicDashboardTreatmentsPostHandler(request({ priceEUR: 100, treatmentId: 'treatment-1' }))).status,
    ).toBe(403)
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
