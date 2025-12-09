import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { createMockReq, createMockPayload, type MockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

type ReadArgs = Parameters<NonNullable<typeof ClinicMedia.access>['read']>[0]
type CreateArgs = Parameters<NonNullable<typeof ClinicMedia.access>['create']>[0]
type UpdateArgs = Parameters<NonNullable<typeof ClinicMedia.access>['update']>[0]
type DeleteArgs = Parameters<NonNullable<typeof ClinicMedia.access>['delete']>[0]

const mockClinicId = 123

describe('ClinicMedia Collection Access Control', () => {
  let payload: MockPayload

  beforeEach(() => {
    payload = createMockPayload()
    vi.resetAllMocks()
  })

  describe('Read Access', () => {
    test('Platform Staff can read all', async () => {
      const req = createMockReq(mockUsers.platform())
      const result = await ClinicMedia.access!.read!({ req } satisfies ReadArgs)
      expect(result).toBe(true)
    })

    test('Clinic Staff is scoped to their clinic', async () => {
      const clinicId = 555
      const req = createMockReq(mockUsers.clinic(2, clinicId), payload)
      // simulate clinic assignment resolution for scoping
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const result = await ClinicMedia.access!.read!({ req } satisfies ReadArgs)
      expect(result).toEqual({ clinic: { equals: clinicId } })
    })

    test('Patient cannot read', async () => {
      const req = createMockReq(mockUsers.patient())
      const result = await ClinicMedia.access!.read!({ req } satisfies ReadArgs)
      expect(result).toBe(false)
    })

    test('Anonymous cannot read', async () => {
      const req = createMockReq(mockUsers.anonymous())
      const result = await ClinicMedia.access!.read!({ req } satisfies ReadArgs)
      expect(result).toBe(false)
    })
  })

  describe('Create Access', () => {
    test('Platform can create for any clinic', async () => {
      const req = createMockReq(mockUsers.platform())
      const can = await ClinicMedia.access!.create!(
        { req, data: { clinic: mockClinicId } } satisfies CreateArgs,
      )
      expect(can).toBe(true)
    })

    test('Clinic staff can create only for their assigned clinic', async () => {
      const user = mockUsers.clinic(2, mockClinicId)
      const req = createMockReq(user, payload)
      // getUserAssignedClinicId will be called if clinicId not present in user; our mockUsers include clinicId
      const can = await ClinicMedia.access!.create!(
        { req, data: { clinic: mockClinicId } } satisfies CreateArgs,
      )
      expect(can).toBe(true)
    })

    test('Clinic staff cannot create for other clinics', async () => {
      const user = mockUsers.clinic(2, 999)
      const req = createMockReq(user, payload)
      const can = await ClinicMedia.access!.create!(
        { req, data: { clinic: mockClinicId } } satisfies CreateArgs,
      )
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', async () => {
      const req = createMockReq(mockUsers.anonymous(), payload)
      const can = await ClinicMedia.access!.create!(
        { req, data: { clinic: mockClinicId } } satisfies CreateArgs,
      )
      expect(can).toBe(false)
    })

    test('Clinic staff without assignment cannot create (no clinicId resolved)', async () => {
      // User without clinicId forces getUserAssignedClinicId path; mock find -> empty to simulate no approved profile
      const user = { ...mockUsers.clinic(2), clinicId: undefined }
      const req = createMockReq(user, payload)
      payload.find.mockResolvedValueOnce({ docs: [] })
      const can = await ClinicMedia.access!.create!(
        { req, data: { clinic: mockClinicId } } satisfies CreateArgs,
      )
      expect(can).toBe(false)
    })

    test('Clinic staff cannot create when data.clinic is missing', async () => {
      const user = mockUsers.clinic(2, mockClinicId)
      const req = createMockReq(user, payload)
      const can = await ClinicMedia.access!.create!({ req, data: {} } as CreateArgs)
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access (scoped)', () => {
    test('Platform can update/delete any', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      const updateScope = await ClinicMedia.access!.update!({ req } satisfies UpdateArgs)
      const deleteScope = await ClinicMedia.access!.delete!({ req } satisfies DeleteArgs)
      expect(updateScope).toBe(true)
      expect(deleteScope).toBe(true)
    })

    test('Clinic staff scoped to their clinic', async () => {
      const req = createMockReq(mockUsers.clinic(2, mockClinicId), payload)
      // Mock getUserAssignedClinicId lookup path: simulate payload.find returning assigned clinic
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const updateScope = await ClinicMedia.access!.update!({ req } satisfies UpdateArgs)
      // For delete we need another call
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const deleteScope = await ClinicMedia.access!.delete!({ req } satisfies DeleteArgs)
      expect(updateScope).toEqual({ clinic: { equals: mockClinicId } })
      expect(deleteScope).toEqual({ clinic: { equals: mockClinicId } })
    })

    test('Other roles cannot update/delete', async () => {
      const patientReq = createMockReq(mockUsers.patient(), payload)
      const anonReq = createMockReq(mockUsers.anonymous(), payload)
      expect(await ClinicMedia.access!.update!({ req: patientReq } satisfies UpdateArgs)).toBe(false)
      expect(await ClinicMedia.access!.delete!({ req: patientReq } satisfies DeleteArgs)).toBe(false)
      expect(await ClinicMedia.access!.update!({ req: anonReq } satisfies UpdateArgs)).toBe(false)
      expect(await ClinicMedia.access!.delete!({ req: anonReq } satisfies DeleteArgs)).toBe(false)
    })

    test('Clinic staff without assignment cannot update/delete', async () => {
      const user = { ...mockUsers.clinic(2), clinicId: undefined }
      const req = createMockReq(user, payload)
      // Simulate no approved clinicStaff profile
      payload.find.mockResolvedValueOnce({ docs: [] })
      expect(await ClinicMedia.access!.update!({ req } satisfies UpdateArgs)).toBe(false)
      payload.find.mockResolvedValueOnce({ docs: [] })
      expect(await ClinicMedia.access!.delete!({ req } satisfies DeleteArgs)).toBe(false)
    })
  })
})
