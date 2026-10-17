import { beforeEach, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import {
  clinicDashboardReviewsGetHandler,
  clinicDashboardReviewResponsesPostHandler,
} from '@/endpoints/clinicDashboardReviewOperations'
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), list: vi.fn(), create: vi.fn() }))
vi.mock('@/features/clinicDashboard/authorization', () => ({ revalidateClinicDashboardTargetRequest: mocks.authorize }))
vi.mock('@/auth/utilities/clinicDashboardOrigin', () => ({ getClinicDashboardOrigin: () => 'http://localhost:3000' }))
vi.mock('@/features/clinicDashboard/reviews/operations', () => ({
  readClinicReviewPage: mocks.list,
  createClinicReviewWorkflow: mocks.create,
}))
function request(method = 'GET', body?: string, origin = 'http://localhost:3000') {
  return Object.assign(
    new Request('http://localhost:3000/api/clinic-dashboard/clinics/42/reviews', {
      method,
      headers: { 'X-Findmydoc-Clinic-Scope-Contract': 'clinic-scope-v1', origin, 'content-type': 'application/json' },
      body,
    }),
    { routeParams: { clinicId: '42' } },
  ) as unknown as PayloadRequest
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue({ status: 'authorized' })
  mocks.list.mockResolvedValue({ docs: [], totalDocs: 0, totalPages: 0, limit: 10, page: 1 })
  mocks.create.mockResolvedValue({ doc: { id: '51' } })
})
it('binds the minimized private list to the current explicit target', async () => {
  const req = request()
  const response = await clinicDashboardReviewsGetHandler(req)
  expect(response.status).toBe(200)
  expect(mocks.authorize).toHaveBeenCalledWith(req, '42')
  expect(mocks.list).toHaveBeenCalledWith(req, '42', undefined)
  expect(response.headers.get('cache-control')).toContain('private, no-store')
  expect(response.headers.get('vary')).toContain('X-Findmydoc-Clinic-Scope-Contract')
})
it('rejects a revoked target before any read', async () => {
  mocks.authorize.mockResolvedValue({ status: 'access-denied' })
  expect((await clinicDashboardReviewsGetHandler(request())).status).toBe(403)
  expect(mocks.list).not.toHaveBeenCalled()
})
it('rejects cross-origin writes before authorization or mutation', async () => {
  expect((await clinicDashboardReviewResponsesPostHandler(request('POST', '{}', 'https://example.com'))).status).toBe(
    403,
  )
  expect(mocks.create).not.toHaveBeenCalled()
  expect(mocks.authorize).not.toHaveBeenCalled()
})
it('rejects oversized bodies before native mutation', async () => {
  expect(
    (await clinicDashboardReviewResponsesPostHandler(request('POST', JSON.stringify({ body: 'x'.repeat(17000) }))))
      .status,
  ).toBe(413)
  expect(mocks.create).not.toHaveBeenCalled()
})
it('passes a bounded JSON command only to the explicit target operation', async () => {
  const body = { review: '204', pendingResponse: { body: 'Thank you for sharing.' } }
  const req = request('POST', JSON.stringify(body))
  expect((await clinicDashboardReviewResponsesPostHandler(req)).status).toBe(200)
  expect(mocks.create).toHaveBeenCalledWith(req, '42', 'reviewResponses', body)
})
