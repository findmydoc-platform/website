import type { PayloadRequest } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authorizeClinicProfileTarget,
  guardClinicProfileDraftWrite,
} from '@/features/clinicDashboard/profile/authorization'

const mocks = vi.hoisted(() => ({ target: vi.fn(), barrier: vi.fn(), session: vi.fn() }))
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicTargetAccess: mocks.target }))
vi.mock('@/features/clinicNotifications/authorizationBarrier', () => ({
  guardClinicAuthorizationKeys: mocks.barrier,
  clinicStaffAuthorizationKey: (id: unknown) => `staff:${id}`,
  notificationClinicAuthorizationKey: (id: unknown) => `clinic:${id}`,
}))
vi.mock('@/collections/clinicNotifications/common', () => ({ requireNotificationTransaction: mocks.session }))
const request = () =>
  ({
    user: { id: 7, collection: 'clinicStaff' },
    context: { clinicProfileTargetId: '42' },
    transactionID: 'owned',
    payload: {},
  }) as unknown as PayloadRequest

describe('profile source authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.target.mockResolvedValue({ clinic: { id: 42 } })
  })
  it('locks the original target and principal before reading current access', async () => {
    const req = request()
    await authorizeClinicProfileTarget(req, 42, true)
    expect(mocks.barrier).toHaveBeenCalledWith(req, ['clinic:42', 'staff:7'])
    expect(mocks.barrier.mock.invocationCallOrder[0]).toBeLessThan(mocks.target.mock.invocationCallOrder[0]!)
    expect(mocks.target).toHaveBeenCalledWith(req.payload, 7, '42', req)
  })
  it('rejects an explicit target mismatch before reading another clinic', async () => {
    await expect(authorizeClinicProfileTarget(request(), 99, true)).rejects.toMatchObject({ status: 403 })
    expect(mocks.target).not.toHaveBeenCalled()
  })
  it('rejects current access loss despite a retained browser target', async () => {
    mocks.target.mockResolvedValue(null)
    await expect(authorizeClinicProfileTarget(request(), 42, true)).rejects.toMatchObject({ status: 403 })
  })
  it('rejects changing a stored draft owner even for a group actor', async () => {
    await expect(
      guardClinicProfileDraftWrite({
        req: request(),
        operation: 'update',
        data: { clinic: 99 },
        originalDoc: { clinic: 42 },
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(mocks.barrier).not.toHaveBeenCalled()
  })
  it('checks the stored owner when an update omits its relationship', async () => {
    const req = request()
    await guardClinicProfileDraftWrite({
      req,
      operation: 'update',
      data: { name: 'Draft' },
      originalDoc: { clinic: 42 },
    })
    expect(mocks.target).toHaveBeenCalledWith(req.payload, 7, '42', req)
  })
})
