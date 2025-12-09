/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DoctorMedia } from '@/collections/DoctorMedia'
import { createMockReq, createMockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

/** DoctorMedia Access Rules Summary:
 *  read: platform -> true, clinic staff -> scoped filter, others -> false
 *  create: platform -> true; clinic staff only if doctor belongs to their clinic
 *  update/delete: platform -> true; clinic staff -> scoped filter; others false
 */

describe('DoctorMedia Collection Access Control', () => {
  let payload: any
  const clinicId = 77
  const otherClinicId = 99

  beforeEach(() => {
    payload = createMockPayload()
    if (!payload.findByID) {
      payload.findByID = vi.fn()
    }
    vi.resetAllMocks()
  })

  describe('Read Access', () => {
    test('Platform can read all', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      const res = await DoctorMedia.access!.read!({ req } as any)
      expect(res).toBe(true)
    })

    test('Clinic staff scoped to clinic', async () => {
      const req = createMockReq(mockUsers.clinic(10, clinicId), payload)
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: clinicId }] }) // resolve assignment
      const res = (await DoctorMedia.access!.read!({ req } as any)) as any
      expect(res).toEqual({ clinic: { equals: clinicId } })
    })

    test('Clinic staff without assignment denied', async () => {
      const user = { ...mockUsers.clinic(10), clinicId: undefined }
      const req = createMockReq(user, payload)
      payload.find.mockResolvedValueOnce({ docs: [] })
      const res = await DoctorMedia.access!.read!({ req } as any)
      expect(res).toBe(false)
    })

    test.each([
      { label: 'Patient', user: mockUsers.patient() },
      { label: 'Anonymous', user: mockUsers.anonymous() },
    ])('$label cannot read', async ({ user }) => {
      const req = createMockReq(user, payload)
      const res = await DoctorMedia.access!.read!({ req } as any)
      expect(res).toBe(false)
    })
  })

  describe('Create Access', () => {
    test('Platform can create for any doctor', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      const can = await DoctorMedia.access!.create!({ req, data: { doctor: 123 } } as any)
      expect(can).toBe(true)
    })

    test('Clinic staff can create if doctor belongs to their clinic', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), payload)
      // getDoctorClinicId -> payload.findByID invoked; we mock via a helper method pattern used in hook path
      payload.findByID.mockResolvedValueOnce({ clinic: clinicId })
      const can = await DoctorMedia.access!.create!({ req, data: { doctor: 321 } } as any)
      expect(can).toBe(true)
    })

    test('Clinic staff cannot create if doctor belongs to different clinic', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), payload)
      payload.findByID.mockResolvedValueOnce({ clinic: otherClinicId })
      const can = await DoctorMedia.access!.create!({ req, data: { doctor: 222 } } as any)
      expect(can).toBe(false)
    })

    test('Clinic staff missing doctor resolves false', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), payload)
      const can = await DoctorMedia.access!.create!({ req, data: {} } as any)
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', async () => {
      const req = createMockReq(mockUsers.anonymous(), payload)
      const can = await DoctorMedia.access!.create!({ req, data: { doctor: 1 } } as any)
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access', () => {
    test('Platform full access', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      expect(await DoctorMedia.access!.update!({ req } as any)).toBe(true)
      expect(await DoctorMedia.access!.delete!({ req } as any)).toBe(true)
    })

    test('Clinic staff scoped', async () => {
      const req = createMockReq(mockUsers.clinic(3, clinicId), payload)
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const updateScope = (await DoctorMedia.access!.update!({ req } as any)) as any
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const deleteScope = (await DoctorMedia.access!.delete!({ req } as any)) as any
      expect(updateScope).toEqual({ clinic: { equals: clinicId } })
      expect(deleteScope).toEqual({ clinic: { equals: clinicId } })
    })

    test.each([
      { label: 'Patient', user: mockUsers.patient() },
      { label: 'Anonymous', user: mockUsers.anonymous() },
    ])('$label cannot mutate', async ({ user }) => {
      const req = createMockReq(user, payload)
      expect(await DoctorMedia.access!.update!({ req } as any)).toBe(false)
      expect(await DoctorMedia.access!.delete!({ req } as any)).toBe(false)
    })
  })
})
