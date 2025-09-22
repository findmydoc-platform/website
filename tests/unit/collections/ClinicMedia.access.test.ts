import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { createMockReq, createMockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

const mockClinicId = 123

describe('ClinicMedia Collection Access Control', () => {
  let payload: any

  beforeEach(() => {
    payload = createMockPayload()
    vi.resetAllMocks()
  })

  describe('Read Access', () => {
    test.each([
      { userType: 'Platform Staff', user: () => mockUsers.platform(), expected: true },
      { userType: 'Clinic Staff', user: () => mockUsers.clinic(), expected: true },
      { userType: 'Patient', user: () => mockUsers.patient(), expected: true },
      { userType: 'Anonymous', user: () => mockUsers.anonymous(), expected: true },
    ])('$userType can read? $expected', ({ user, expected }) => {
      const req = createMockReq(user())
      const result = ClinicMedia.access!.read!({ req } as any)
      expect(result).toBe(expected)
    })
  })

  describe('Create Access', () => {
    test('Platform can create for any clinic', async () => {
      const req = createMockReq(mockUsers.platform())
      const can = await ClinicMedia.access!.create!({ req, data: { clinic: mockClinicId } } as any)
      expect(can).toBe(true)
    })

    test('Clinic staff can create only for their assigned clinic', async () => {
      const user = mockUsers.clinic(2, mockClinicId)
      const req = createMockReq(user, payload)
      // getUserAssignedClinicId will be called if clinicId not present in user; our mockUsers include clinicId
      const can = await ClinicMedia.access!.create!({ req, data: { clinic: mockClinicId } } as any)
      expect(can).toBe(true)
    })

    test('Clinic staff cannot create for other clinics', async () => {
      const user = mockUsers.clinic(2, 999)
      const req = createMockReq(user, payload)
      const can = await ClinicMedia.access!.create!({ req, data: { clinic: mockClinicId } } as any)
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', async () => {
      const req = createMockReq(mockUsers.anonymous(), payload)
      const can = await ClinicMedia.access!.create!({ req, data: { clinic: mockClinicId } } as any)
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access (scoped)', () => {
    test('Platform can update/delete any', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      const updateScope = await ClinicMedia.access!.update!({ req } as any)
      const deleteScope = await ClinicMedia.access!.delete!({ req } as any)
      expect(updateScope).toBe(true)
      expect(deleteScope).toBe(true)
    })

    test('Clinic staff scoped to their clinic', async () => {
      const req = createMockReq(mockUsers.clinic(2, mockClinicId), payload)
      // Mock getUserAssignedClinicId lookup path: simulate payload.find returning assigned clinic
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const updateScope = (await ClinicMedia.access!.update!({ req } as any)) as any
      // For delete we need another call
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const deleteScope = (await ClinicMedia.access!.delete!({ req } as any)) as any
      expect(updateScope).toEqual({ clinic: { equals: mockClinicId } })
      expect(deleteScope).toEqual({ clinic: { equals: mockClinicId } })
    })

    test('Other roles cannot update/delete', async () => {
      const patientReq = createMockReq(mockUsers.patient(), payload)
      const anonReq = createMockReq(mockUsers.anonymous(), payload)
      expect(await ClinicMedia.access!.update!({ req: patientReq } as any)).toBe(false)
      expect(await ClinicMedia.access!.delete!({ req: patientReq } as any)).toBe(false)
      expect(await ClinicMedia.access!.update!({ req: anonReq } as any)).toBe(false)
      expect(await ClinicMedia.access!.delete!({ req: anonReq } as any)).toBe(false)
    })
  })
})
