import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { clinicDashboardReviewGetHandler } from '@/endpoints/clinicDashboardReviews'
import examples from '../../fixtures/clinic-review-detail-v1.json'

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), resolve: vi.fn() }))
vi.mock('@/features/clinicDashboard/authorization', () => ({ revalidateClinicDashboardTargetRequest: mocks.authorize }))
vi.mock('@/features/clinicDashboard/reviews/service', () => ({ readClinicReviewDetail: mocks.resolve }))

const detail = {
  id: 'review-204',
  reviewDate: '2026-10-14T10:00:00.000Z',
  starRating: 5,
  status: 'approved',
  treatment: { id: 'treatment-204', name: 'Dentistry' },
  publicMeasure: 'none',
  withdrawalState: 'active',
  publicAuthorName: 'Maya K.',
  comment: 'Permitted current review text.',
}
const request = (id = 'review-204', query = '') =>
  Object.assign(
    new Request(`http://localhost:3000/api/clinic-dashboard/clinics/42/reviews/${id}${query}`, {
      headers: { 'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1' },
    }),
    {
      routeParams: { clinicId: '42', id },
      payload: { logger: { error: vi.fn() } },
    },
  ) as unknown as PayloadRequest

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue({ status: 'authorized', clinicId: '42' })
  mocks.resolve.mockResolvedValue(detail)
})

describe('ordinary authorized exact review HTTP boundary', () => {
  it('returns the literal minimized current detail with private headers', async () => {
    const response = await clinicDashboardReviewGetHandler(request())
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: detail })
    expect(response.headers.get('cache-control')).toContain('private, no-store')
    expect(response.headers.get('vary')).toBe('Authorization, X-Findmydoc-Clinic-Scope-Contract')
    expect(mocks.authorize).toHaveBeenCalledWith(expect.anything(), '42')
    expect(mocks.resolve).toHaveBeenCalledWith(expect.anything(), 'review-204', '42')
  })
  it.each([
    { authorization: { status: 'unauthorized' }, status: 401, code: 'UNAUTHENTICATED' },
    { authorization: { status: 'access-denied' }, status: 403, code: 'CONTENT_ACCESS_DENIED' },
    { authorization: { status: 'unavailable' }, status: 503, code: 'SERVICE_UNAVAILABLE' },
  ])('denies $code before loading source', async ({ authorization, status, code }) => {
    mocks.authorize.mockResolvedValue(authorization)
    const response = await clinicDashboardReviewGetHandler(request())
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ error: { code } })
    expect(mocks.resolve).not.toHaveBeenCalled()
  })
  it('keeps unavailable source distinct from authorized notifications', async () => {
    mocks.resolve.mockResolvedValue(null)
    const response = await clinicDashboardReviewGetHandler(request())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: { code: 'TARGET_UNAVAILABLE' } })
  })
  it.each(examples.accepted)('preserves each closed permitted current detail example', async (example) => {
    mocks.resolve.mockResolvedValue(example.data)
    expect(await (await clinicDashboardReviewGetHandler(request())).json()).toEqual(example)
  })
  it.each(examples.rejected)('rejects unknown or forbidden source representations', async (example) => {
    mocks.resolve.mockResolvedValue(example.data)
    const response = await clinicDashboardReviewGetHandler(request())
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: { code: 'SERVICE_UNAVAILABLE' } })
  })
  it.each([
    { id: 'bad.id', query: '' },
    { id: 'review-204', query: '?clinicId=foreign' },
  ])('rejects unsupported input', async ({ id, query }) => {
    const response = await clinicDashboardReviewGetHandler(request(id, query))
    expect(response.status).toBe(400)
    expect(mocks.resolve).not.toHaveBeenCalled()
  })
})
