import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'
import { guardDoctorChange } from '@/features/doctorProfiles/authorization'

const authorization = vi.hoisted(() => ({ barrier: vi.fn(), target: vi.fn(async () => ({ clinic: { id: 11 } })) }))
vi.mock('@/auth/utilities/clinicPrincipalAccess', () => ({ readClinicTargetAccess: authorization.target }))
vi.mock('@/features/clinicNotifications/authorizationBarrier', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/clinicNotifications/authorizationBarrier')>()),
  guardClinicAuthorizationKeys: authorization.barrier,
}))

describe('Controlled doctor join normalization', () => {
  it.each(['doctorspecialties', 'doctortreatments'])(
    'retains numeric doctor references in %s before field validation',
    async (slug) => {
      const req = {
        user: { collection: 'clinicStaff', id: 7 },
        payload: {
          findByID: vi.fn(async ({ collection }: { collection: string }) =>
            collection === 'doctors' ? { id: 41, clinic: 11 } : { id: 11 },
          ),
        },
      } as unknown as PayloadRequest
      const data = { doctor: '41', specializationLevel: 'expert' }
      await expect(
        guardDoctorChange({
          req,
          data,
          context: {},
          operation: 'create',
          collection: { slug },
        } as unknown as Parameters<typeof guardDoctorChange>[0]),
      ).resolves.toMatchObject({ doctor: 41 })
      expect(authorization.target).toHaveBeenCalledWith(req.payload, 7, 11, req)
      expect(authorization.barrier).toHaveBeenCalledWith(
        req,
        expect.arrayContaining(['notification-authorization:clinic:11', 'notification-authorization:staff:7']),
      )
    },
  )
})
