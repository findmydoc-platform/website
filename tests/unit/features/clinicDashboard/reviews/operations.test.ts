import { beforeEach, expect, it, vi } from 'vitest'
import { APIError, type PayloadRequest } from 'payload'
import {
  readClinicReviewPage,
  readClinicReviewWorkflows,
  createClinicReviewWorkflow,
  updateClinicReviewResponse,
} from '@/features/clinicDashboard/reviews/operations'
const mocks = vi.hoisted(() => ({ detail: vi.fn(), project: vi.fn() }))
vi.mock('@/features/clinicDashboard/reviews/service', () => ({
  readClinicReviewDetail: mocks.detail,
  projectClinicReviewDetail: mocks.project,
}))
function request(query = '') {
  return {
    url: `http://localhost:3000/reviews${query}`,
    payload: { find: vi.fn(), create: vi.fn(), update: vi.fn() },
  } as unknown as PayloadRequest
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.detail.mockResolvedValue({ id: '204' })
  mocks.project.mockReturnValue({ id: '204' })
})
it('intersects approved list filters with source clinic and projects only public review details', async () => {
  const req = request('?depth=1&limit=10&page=2&sort=-reviewDate&where[starRating][equals]=5')
  vi.mocked(req.payload.find).mockResolvedValue({
    docs: [{ id: 204, clinic: 42 }],
    limit: 10,
    page: 2,
    totalDocs: 11,
    totalPages: 2,
  } as never)
  expect(await readClinicReviewPage(req, '42')).toEqual({
    docs: [{ id: '204' }],
    limit: 10,
    page: 2,
    totalDocs: 11,
    totalPages: 2,
  })
  expect(req.payload.find).toHaveBeenCalledWith(
    expect.objectContaining({
      overrideAccess: false,
      req,
      page: 2,
      where: { and: [{ clinic: { equals: 42 } }, { status: { equals: 'approved' } }, { starRating: { equals: '5' } }] },
    }),
  )
})
it.each(['?where[clinic][equals]=99', '?depth=1&depth=0', '?limit=1000'])(
  'rejects unsupported list query %s before source read',
  async (query) => {
    const req = request(query)
    await expect(readClinicReviewPage(req, '42')).rejects.toBeInstanceOf(APIError)
    expect(req.payload.find).not.toHaveBeenCalled()
  },
)
it('fails closed if any requested workflow source belongs to another clinic', async () => {
  const req = request('?depth=0&limit=1&pagination=false&where[review][in]=204')
  vi.mocked(req.payload.find).mockResolvedValue({ docs: [{ id: 204, clinic: 99 }] } as never)
  await expect(readClinicReviewWorkflows(req, '42', 'reviewAppeals')).rejects.toMatchObject({ status: 404 })
  expect(req.payload.find).toHaveBeenCalledTimes(1)
})
it('never forwards clinic or moderation fields through a response command', async () => {
  const req = request()
  await expect(
    createClinicReviewWorkflow(req, '42', 'reviewResponses', {
      review: 204,
      clinic: 99,
      pendingResponse: { body: 'A bounded response text.' },
    }),
  ).rejects.toMatchObject({ status: 400 })
  expect(req.payload.create).not.toHaveBeenCalled()
})
it('requires current exact source before creating an appeal', async () => {
  const req = request()
  mocks.detail.mockResolvedValue(null)
  await expect(
    createClinicReviewWorkflow(req, '42', 'reviewAppeals', {
      review: 204,
      reason: 'privacy_concern',
      details: 'Synthetic private concern.',
    }),
  ).rejects.toMatchObject({ status: 404 })
  expect(req.payload.create).not.toHaveBeenCalled()
})
it('cannot revise a workflow selected from another clinic', async () => {
  const req = request()
  vi.mocked(req.payload.find).mockResolvedValue({ docs: [{ id: 51, clinic: 99, review: 204 }] } as never)
  await expect(
    updateClinicReviewResponse(req, '42', '51', { pendingResponse: { body: 'A bounded response text.' } }),
  ).rejects.toMatchObject({ status: 404 })
  expect(req.payload.update).not.toHaveBeenCalled()
})
