import { beforeEach, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { readClinicReviewDetail } from '@/features/clinicDashboard/reviews/service'
const policy = vi.hoisted(() => vi.fn())
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicTargetAccess: policy }))
beforeEach(() => vi.clearAllMocks())
it('reads an exact current review only in the explicit currently authorized clinic', async () => {
  policy.mockResolvedValue({ clinic: { id: 42 }, staff: { id: 7 } })
  const find = vi.fn(async () => ({
    docs: [
      {
        id: 204,
        clinic: 42,
        status: 'approved',
        reviewDate: '2026-10-14T10:00:00.000Z',
        starRating: 5,
        treatment: { id: 8, name: 'Dentistry' },
        publicMeasure: 'none',
        withdrawalState: 'active',
        comment: 'Permitted current text.',
      },
    ],
  }))
  const req = { user: { id: 7, collection: 'clinicStaff' }, payload: { find } } as unknown as PayloadRequest
  await expect(readClinicReviewDetail(req, '204', '42')).resolves.toMatchObject({
    id: '204',
    comment: 'Permitted current text.',
  })
  expect(policy).toHaveBeenCalledWith(req.payload, 7, '42', req)
  expect(find).toHaveBeenCalledWith(
    expect.objectContaining({
      overrideAccess: false,
      where: { and: [{ id: { equals: '204' } }, { clinic: { equals: 42 } }] },
    }),
  )
  policy.mockResolvedValue(null)
  await expect(readClinicReviewDetail(req, '204', '99')).resolves.toBeNull()
  expect(find).toHaveBeenCalledTimes(1)
})
