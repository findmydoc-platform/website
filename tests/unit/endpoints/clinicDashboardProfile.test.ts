import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clinicDashboardProfileDraftPostHandler,
  clinicDashboardProfileDraftPutHandler,
  clinicDashboardProfileGetHandler,
} from '@/endpoints/clinicDashboardProfile'
import { ClinicProfileServiceError } from '@/features/clinicDashboard/profile/service'

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  create: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
}))

vi.mock('@/features/clinicDashboard/bootstrap', () => ({
  resolveClinicDashboardBootstrap: mocks.bootstrap,
}))

vi.mock('@/features/clinicDashboard/profile/service', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/features/clinicDashboard/profile/service')>()
  return {
    ...original,
    createClinicProfileDraft: mocks.create,
    readClinicProfileSnapshot: mocks.read,
    saveClinicProfileDraft: mocks.save,
  }
})

const snapshot = {
  availableCities: [],
  published: {
    address: {
      country: { code: 'TR', name: 'Türkiye' },
      houseNumber: '1',
      street: 'Street',
      zipCode: '34000',
    },
    descriptionText: '',
    name: 'Clinic',
    revision: 0,
    supportedLanguages: ['english'],
  },
}

const request = (body?: unknown) =>
  ({
    headers: new Headers({ authorization: 'Bearer token' }),
    json: vi.fn(async () => body),
    payload: {
      logger: {
        error: vi.fn(),
      },
    },
  }) as unknown as PayloadRequest

describe('Clinic Dashboard profile endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        clinic: { id: '42', name: 'Assigned clinic' },
      },
    })
    mocks.read.mockResolvedValue(snapshot)
    mocks.create.mockResolvedValue(snapshot)
    mocks.save.mockResolvedValue(snapshot)
  })

  it('returns the assigned clinic snapshot with private-live headers', async () => {
    const response = await clinicDashboardProfileGetHandler(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, X-Findmydoc-Clinic-Dashboard-Contract')
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), '42')
  })

  it('does not accept a caller-provided clinic id', async () => {
    const response = await clinicDashboardProfileDraftPostHandler(
      request({
        clinicId: '99',
        expectedPublishedRevision: 0,
      }),
    )

    expect(response.status).toBe(400)
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('creates a draft for the server-assigned clinic only', async () => {
    const response = await clinicDashboardProfileDraftPostHandler(
      request({
        expectedPublishedRevision: 0,
      }),
    )

    expect(response.status).toBe(201)
    expect(mocks.create).toHaveBeenCalledWith(expect.anything(), '42', {
      expectedPublishedRevision: 0,
    })
  })

  it('maps optimistic-concurrency conflicts to 409', async () => {
    mocks.save.mockRejectedValue(new ClinicProfileServiceError('conflict', 'changed'))
    const response = await clinicDashboardProfileDraftPutHandler(
      request({
        draft: {
          address: { houseNumber: '', street: '', zipCode: '' },
          descriptionText: '',
          name: '',
          supportedLanguages: [],
        },
        expectedDraftRevision: 1,
        expectedPublishedRevision: 0,
      }),
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: { code: 'CLINIC_PROFILE_CONFLICT' },
    })
  })

  it('reuses bootstrap authorization failures', async () => {
    mocks.bootstrap.mockResolvedValue({ status: 'access-denied' })

    const response = await clinicDashboardProfileGetHandler(request())

    expect(response.status).toBe(403)
    expect(mocks.read).not.toHaveBeenCalled()
  })
})
