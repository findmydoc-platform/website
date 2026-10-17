import type { PayloadRequest } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clinicDashboardGalleryDiscardPostHandler,
  clinicDashboardGalleryGetHandler,
  clinicDashboardGalleryImageGetHandler,
  clinicDashboardGalleryPutHandler,
} from '@/endpoints/clinicDashboardGallery'
import { ClinicGalleryServiceError } from '@/features/clinicDashboard/gallery/service'

const mocks = vi.hoisted(() => ({
  after: vi.fn((callback: () => unknown) => void callback()),
  bootstrap: vi.fn(),
  cleanup: vi.fn().mockResolvedValue(undefined),
  discard: vi.fn(),
  read: vi.fn(),
  image: vi.fn(),
  save: vi.fn(),
}))

vi.mock('next/server', () => ({ after: mocks.after }))
vi.mock('@/features/clinicDashboard/bootstrap', () => ({ resolveClinicScopeBootstrap: mocks.bootstrap }))
vi.mock('@/features/clinicDashboard/gallery/cleanup', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/gallery/cleanup')>()),
  cleanupClinicGalleryDraftMedia: mocks.cleanup,
}))
vi.mock('@/features/clinicDashboard/gallery/service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicDashboard/gallery/service')>()),
  discardClinicGalleryDrafts: mocks.discard,
  readClinicGallerySnapshot: mocks.read,
  readClinicGalleryImageSource: mocks.image,
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
    searchParams: new URLSearchParams(),
    routeParams: { clinicId: '42' },
    headers: new Headers({ authorization: 'Bearer token', 'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1' }),
    json: vi.fn(async () => body),
    payload: { logger: { error: vi.fn() } },
  }) as unknown as PayloadRequest

describe('Clinic Dashboard gallery endpoints', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('rejects gallery reads without an explicit clinic target', async () => {
    const req = request()
    req.routeParams = {}
    expect((await clinicDashboardGalleryGetHandler(req)).status).toBe(400)
    expect(mocks.read).not.toHaveBeenCalled()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: {
        clinics: [{ id: '42', name: 'Assigned clinic', capabilities: ['clinic-gallery:view', 'clinic-gallery:edit'] }],
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

  it('re-authorizes the explicit media source before returning private image bytes', async () => {
    mocks.image.mockResolvedValueOnce('https://preview.findmydoc.eu/api/clinicMedia/file/reception.png')
    const fetcher = vi.fn(
      async () => new Response(new Uint8Array([1, 2]), { headers: { 'Content-Type': 'image/png' } }),
    )
    vi.stubGlobal('fetch', fetcher)
    const req = request()
    req.routeParams = { clinicId: '42', mediaId: '9' }
    const response = await clinicDashboardGalleryImageGetHandler(req)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.image).toHaveBeenCalledWith(req, '42', '9', 'original')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
    const foreign = request()
    foreign.routeParams = { clinicId: '43', mediaId: '9' }
    expect((await clinicDashboardGalleryImageGetHandler(foreign)).status).toBe(403)
    expect(fetcher).toHaveBeenCalledOnce()
  })

  it('does not fetch a foreign stored media ID or invalid image selector', async () => {
    mocks.image.mockRejectedValueOnce(new ClinicGalleryServiceError('not-found', 'Missing source'))
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    const req = request()
    req.routeParams = { clinicId: '42', mediaId: '99' }
    expect((await clinicDashboardGalleryImageGetHandler(req)).status).toBe(404)
    req.searchParams.set('size', 'foreign-storage-key')
    expect((await clinicDashboardGalleryImageGetHandler(req)).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('enforces method-specific gallery capabilities', async () => {
    mocks.bootstrap.mockResolvedValue({
      status: 'success',
      data: { clinics: [{ capabilities: ['clinic-gallery:view'], id: '42', name: 'Assigned clinic' }] },
    })

    expect((await clinicDashboardGalleryGetHandler(request())).status).toBe(200)
    expect((await clinicDashboardGalleryPutHandler(request({ expectedRevision: 4, items: [] }))).status).toBe(403)
    expect(mocks.save).not.toHaveBeenCalled()
  })
})
