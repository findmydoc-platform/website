import { describe, expect, it, vi } from 'vitest'
import type { PayloadRequest } from 'payload'

import { beforeChangeAssignClinicFromUser, beforeChangeEnforceDoctorInAssignedClinic } from '@/hooks/clinicOwnership'

type MockPayload = {
  find: ReturnType<typeof vi.fn>
  findByID: ReturnType<typeof vi.fn>
  logger: {
    warn: ReturnType<typeof vi.fn>
    error: ReturnType<typeof vi.fn>
  }
}

const createReq = (user?: unknown, payloadOverrides?: Partial<MockPayload>) => {
  const payload: MockPayload = {
    find: vi.fn(),
    findByID: vi.fn(),
    logger: {
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...payloadOverrides,
  }

  const req = {
    user,
    payload,
  } as unknown as PayloadRequest

  return { req, payload }
}

describe('clinic ownership hooks', () => {
  describe('beforeChangeAssignClinicFromUser', () => {
    it('assigns clinic on create for clinic users when clinic is omitted', async () => {
      const { req } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic', clinicId: 44 })
      const hook = beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })

      const result = await hook({
        data: { firstName: 'John' },
        operation: 'create',
        req,
        originalDoc: undefined,
        collection: { slug: 'doctors' } as never,
        context: {} as never,
      })

      expect(result).toEqual({ firstName: 'John', clinic: 44 })
    })

    it('throws when clinic users submit a foreign clinic', async () => {
      const { req } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic', clinicId: 44 })
      const hook = beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })

      await expect(
        hook({
          data: { clinic: 99 },
          operation: 'create',
          req,
          originalDoc: undefined,
          collection: { slug: 'doctors' } as never,
          context: {} as never,
        }),
      ).rejects.toThrow('Clinic staff cannot assign records to another clinic')
    })

    it('throws when clinic users do not have an assigned clinic', async () => {
      const { req, payload } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic' })
      payload.find.mockResolvedValueOnce({ docs: [] })

      const hook = beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })

      await expect(
        hook({
          data: { firstName: 'John' },
          operation: 'create',
          req,
          originalDoc: undefined,
          collection: { slug: 'doctors' } as never,
          context: {} as never,
        }),
      ).rejects.toThrow('Clinic staff must be assigned to a clinic before creating or updating records')
    })

    it('leaves platform payload unchanged', async () => {
      const { req } = createReq({ id: 1, collection: 'basicUsers', userType: 'platform' })
      const hook = beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })

      const result = await hook({
        data: { clinic: 33, firstName: 'Jane' },
        operation: 'create',
        req,
        originalDoc: undefined,
        collection: { slug: 'doctors' } as never,
        context: {} as never,
      })

      expect(result).toEqual({ clinic: 33, firstName: 'Jane' })
    })
  })

  describe('beforeChangeEnforceDoctorInAssignedClinic', () => {
    it('allows clinic users when doctor belongs to assigned clinic', async () => {
      const { req, payload } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic', clinicId: 44 })
      payload.findByID.mockResolvedValueOnce({ clinic: 44 })

      const hook = beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })

      const result = await hook({
        data: { doctor: 101 },
        operation: 'create',
        req,
        originalDoc: undefined,
        collection: { slug: 'doctorspecialties' } as never,
        context: {} as never,
      })

      expect(result).toEqual({ doctor: 101 })
    })

    it('blocks clinic users when doctor belongs to a foreign clinic', async () => {
      const { req, payload } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic', clinicId: 44 })
      payload.findByID.mockResolvedValueOnce({ clinic: 99 })

      const hook = beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })

      await expect(
        hook({
          data: { doctor: 101 },
          operation: 'create',
          req,
          originalDoc: undefined,
          collection: { slug: 'doctorspecialties' } as never,
          context: {} as never,
        }),
      ).rejects.toThrow('Selected doctor does not belong to your assigned clinic')
    })

    it('blocks clinic users when doctor is missing', async () => {
      const { req } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic', clinicId: 44 })
      const hook = beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })

      await expect(
        hook({
          data: {},
          operation: 'create',
          req,
          originalDoc: undefined,
          collection: { slug: 'doctorspecialties' } as never,
          context: {} as never,
        }),
      ).rejects.toThrow('Doctor is required for this operation')
    })

    it('blocks clinic users without clinic assignment', async () => {
      const { req, payload } = createReq({ id: 10, collection: 'basicUsers', userType: 'clinic' })
      payload.find.mockResolvedValueOnce({ docs: [] })

      const hook = beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })

      await expect(
        hook({
          data: { doctor: 101 },
          operation: 'create',
          req,
          originalDoc: undefined,
          collection: { slug: 'doctorspecialties' } as never,
          context: {} as never,
        }),
      ).rejects.toThrow('Clinic staff must be assigned to a clinic before creating or updating records')
    })
  })
})
