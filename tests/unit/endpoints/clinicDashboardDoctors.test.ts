import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { clinicDashboardDoctorEndpoints } from '@/endpoints/clinicDashboardDoctors'
const authorize = vi.hoisted(() => vi.fn())
vi.mock('@/features/clinicDashboard/authorization', () => ({ revalidateClinicDashboardTargetRequest: authorize }))

describe('Explicit clinic doctor endpoint', () => {
  afterEach(() => vi.clearAllMocks())
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
