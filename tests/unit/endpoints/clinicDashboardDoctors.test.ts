import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { clinicDashboardDoctorEndpoints } from '@/endpoints/clinicDashboardDoctors'
const authorize = vi.hoisted(() => vi.fn())
vi.mock('@/features/clinicDashboard/authorization', () => ({ revalidateClinicDashboardTargetRequest: authorize }))

describe('Explicit clinic doctor endpoint', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  it('adds the actual clinic constraint to a caller-supplied record query', async () => {
    authorize.mockResolvedValue({ status: 'authorized', clinicId: '11' })
    const find = vi.fn().mockResolvedValue({ docs: [], totalDocs: 0 })
    const req = {
      url: 'http://localhost:3000/api/clinic-dashboard/clinics/11/doctors?where[id][equals]=99',
      query: { where: { id: { equals: '99' } } },
      routeParams: { clinicId: '11' },
      payload: { find },
    } as unknown as PayloadRequest
    const response = await clinicDashboardDoctorEndpoints
      .find(({ path, method }) => path.endsWith('/doctors') && method === 'get')!
      .handler(req)
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({
        overrideAccess: false,
        req,
        where: { and: [{ clinic: { equals: 11 } }, { id: { equals: '99' } }] },
      }),
    )
  })
  it.each([
    { source: '/api/doctorMedia/file/portrait.png', status: 200 },
    { source: 'https://foreign.example/api/doctorMedia/file/portrait.png', status: 503 },
    { source: '/api/clinicMedia/file/portrait.png', status: 503 },
  ])('confines current invocation image access to the stored doctor source $source', async ({ source, status }) => {
    vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://preview.findmydoc.eu')
    authorize.mockResolvedValue({ status: 'authorized', clinicId: '11' })
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [{ id: 7, profileImage: 8 }] })
      .mockResolvedValueOnce({ docs: [{ id: 8, url: source }] })
    const fetcher = vi.fn(
      async () =>
        new Response(new Uint8Array([1, 2]), {
          headers: { 'Content-Type': 'image/png' },
        }),
    )
    vi.stubGlobal('fetch', fetcher)
    const req = {
      url: 'https://preview.findmydoc.eu/api/clinic-dashboard/clinics/11/doctors/7/image',
      routeParams: { clinicId: '11', id: '7' },
      headers: new Headers({
        authorization: 'Bearer clinic-session',
        'x-vercel-oidc-token': 'website-current-invocation',
        'x-vercel-trusted-oidc-idp-token': 'foreign-caller-identity',
      }),
      payload: { find },
    } as unknown as PayloadRequest
    const response = await clinicDashboardDoctorEndpoints.find(({ path }) => path.endsWith('/image'))!.handler(req)
    expect(response.status).toBe(status)
    if (status === 200) {
      expect(fetcher).toHaveBeenCalledWith(new URL('https://preview.findmydoc.eu/api/doctorMedia/file/portrait.png'), {
        cache: 'no-store',
        redirect: 'error',
        signal: expect.any(AbortSignal),
        headers: {
          Authorization: 'Bearer clinic-session',
          'x-vercel-trusted-oidc-idp-token': 'website-current-invocation',
        },
      })
      expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([1, 2]))
      expect(find).toHaveBeenLastCalledWith(
        expect.objectContaining({
          overrideAccess: false,
          req,
          where: { and: [{ id: { equals: 8 } }, { doctor: { equals: 7 } }, { clinic: { equals: 11 } }] },
        }),
      )
    } else expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects an inaccessible clinic before resolving records and returns no existence signal', async () => {
    authorize.mockResolvedValue({ status: 'access-denied' })
    const find = vi.fn()
    const req = {
      url: 'http://localhost:3000/api/clinic-dashboard/clinics/99/doctors',
      routeParams: { clinicId: '99' },
      payload: { find },
    } as unknown as PayloadRequest
    const response = await clinicDashboardDoctorEndpoints
      .find(({ path, method }) => path.endsWith('/doctors') && method === 'get')!
      .handler(req)
    expect(response.status).toBe(403)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(find).not.toHaveBeenCalled()
  })
})
