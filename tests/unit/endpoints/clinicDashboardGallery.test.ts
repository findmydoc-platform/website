import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clinicDashboardGalleryDiscardPostHandler,
  clinicDashboardGalleryGetHandler,
  clinicDashboardGalleryPutHandler,
} from '@/endpoints/clinicDashboardGallery'
import { ClinicGalleryServiceError } from '@/features/clinicDashboard/gallery/service'

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => void callback()),
  bootstrap: vi.fn(),
  cleanup: vi.fn().mockResolvedValue(undefined),
  discard: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/features/clinicDashboard/bootstrap', () => ({ resolveClinicDashboardBootstrap: mocks.bootstrap }))
vi.mock('@/features/clinicDashboard/gallery/cleanup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/gallery/cleanup')>()),
  cleanupClinicGalleryDraftMedia: mocks.cleanup,
}))
vi.mock('@/features/clinicDashboard/gallery/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/gallery/service')>()),
  discardClinicGalleryDrafts: mocks.discard,
  readClinicGallerySnapshot: mocks.read,
  saveClinicGallery: mocks.save,
}))

const snapshot = {
  constraints: {
    acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    maxConcurrentUploads: 3,
    maxFileBytes: 4 * 1024 * 1024,
    maxItems: 12,
    maxPixels: 50_000_000,
  },
  items: [],
  revision: 4,
}

const request = (body?: unknown) =>
  ({
    context: {},
    headers: new Headers({ authorization: 'Bearer token' }),
    json: vi.fn(async () => body),
    payload: { logger: { error: vi.fn() } },
  }) as unknown as PayloadRequest

describe('Clinic Dashboard gallery endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        capabilities: ['clinic-gallery:view', 'clinic-gallery:edit'],
        clinic: { id: '42', name: 'Assigned clinic' },
      },
    })
    mocks.read.mockResolvedValue({ cleanupCandidateIds: ['9'], snapshot })
    mocks.save.mockResolvedValue({ cleanupCandidateIds: ['8'], removedMediaIds: ['8'], snapshot })
    mocks.discard.mockResolvedValue(['7'])
  })

  it('returns a private snapshot and schedules abandoned-draft cleanup after the response', async () => {
    const response = await clinicDashboardGalleryGetHandler(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.read).toHaveBeenCalledWith(expect.anything(), '42')
    expect(mocks.after).toHaveBeenCalledOnce()
    expect(mocks.cleanup).toHaveBeenCalledWith(expect.anything(), '42', ['9'], 'gallery-read', expect.anything())
  })

  it('requires the current profile revision and maps conflicts to the stable 409 code', async () => {
    const input = { expectedRevision: 4, items: [] }
    expect((await clinicDashboardGalleryPutHandler(request(input))).status).toBe(200)
    expect(mocks.save).toHaveBeenCalledWith(expect.anything(), '42', input)

    mocks.save.mockRejectedValueOnce(new ClinicGalleryServiceError('conflict', 'changed'))
    const conflict = await clinicDashboardGalleryPutHandler(request(input))
    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toEqual({ error: { code: 'CLINIC_GALLERY_CONFLICT' } })
  })

  it('discards only validated batches and keeps cleanup asynchronous', async () => {
    const accepted = await clinicDashboardGalleryDiscardPostHandler(request({ mediaIds: ['7'] }))
    expect(accepted.status).toBe(202)
    expect(mocks.cleanup).toHaveBeenCalledWith(expect.anything(), '42', ['7'], 'discard', expect.anything())

    const rejected = await clinicDashboardGalleryDiscardPostHandler(
      request({ mediaIds: Array.from({ length: 13 }, (_, index) => String(index + 1)) }),
    )
    expect(rejected.status).toBe(400)
    expect(mocks.discard).toHaveBeenCalledOnce()
  })

  it('enforces method-specific gallery capabilities', async () => {
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: { capabilities: ['clinic-gallery:view'], clinic: { id: '42', name: 'Assigned clinic' } },
    })

    expect((await clinicDashboardGalleryGetHandler(request())).status).toBe(200)
    expect((await clinicDashboardGalleryPutHandler(request({ expectedRevision: 4, items: [] }))).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
