import { beforeEach, expect, it, vi } from 'vitest'
import { ReviewResponses } from '@/collections/ReviewResponses'
import { ReviewAppeals } from '@/collections/ReviewAppeals'
import { Reviews } from '@/collections/Reviews'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
const policy = vi.hoisted(() => vi.fn())
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({
  readClinicPrincipalAccess: policy,
  readClinicTargetAccess: vi.fn(),
}))
beforeEach(() => {
  vi.clearAllMocks()
  policy.mockResolvedValue({ staff: { id: 7 }, clinics: [{ id: 42 }, { id: 43 }] })
})
it('scopes current review workflows to eligible clinics and intersects an explicit path target', async () => {
  const req = createMockReq(mockUsers.clinic())
  await expect(ReviewResponses.access!.read!({ req })).resolves.toEqual({ clinic: { in: [42, 43] } })
  req.routeParams = { clinicId: '43' }
  await expect(ReviewAppeals.access!.read!({ req })).resolves.toEqual({ clinic: { equals: 43 } })
  req.routeParams = { clinicId: '99' }
  await expect(ReviewAppeals.access!.read!({ req })).resolves.toBe(false)
})
it('retains approved-review and workflow-version visibility within current scope', async () => {
  const req = createMockReq(mockUsers.clinic())
  await expect(Reviews.access!.read!({ req })).resolves.toEqual({
    and: [{ status: { equals: 'approved' } }, { clinic: { in: [42, 43] } }],
  })
  await expect(ReviewAppeals.access!.readVersions!({ req })).resolves.toEqual({ 'version.clinic': { in: [42, 43] } })
})
it('does not grant create or native reads from a stale local identity after current access is lost', async () => {
  const req = createMockReq(mockUsers.clinic())
  policy.mockResolvedValue({ staff: { id: 7 }, clinics: [] })
  await expect(ReviewResponses.access!.create!({ req })).resolves.toBe(false)
  await expect(ReviewResponses.access!.read!({ req })).resolves.toBe(false)
})
