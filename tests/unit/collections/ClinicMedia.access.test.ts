import { describe, test, expect, vi, beforeEach } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { createAccessArgs, createMockReq, createMockPayload, type MockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import type { AccessArgs } from 'payload'

const mockClinicId = 123

describe('ClinicMedia Collection Access Control', () => {
  let payload: MockPayload

  beforeEach(() => {
    payload = createMockPayload()
    vi.resetAllMocks()
  })

  describe('Read Access', () => {
    test('Platform Staff can read all', async () => {
      const result = await ClinicMedia.access!.read!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(mockUsers.platform()),
      )
      expect(result).toBe(true)
    })

    test('Clinic Staff is scoped to their clinic', async () => {
      const clinicId = 555
      const req = createMockReq(mockUsers.clinic(2, clinicId), payload)
      // simulate clinic assignment resolution for scoping
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const result = await ClinicMedia.access!.read!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload }),
      )
      expect(result).toEqual({ clinic: { equals: clinicId } })
    })

    test('Patient cannot read', async () => {
      const req = createMockReq(mockUsers.patient())
      const result = await ClinicMedia.access!.read!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user))
      expect(result).toBe(false)
    })

    test('Anonymous cannot read', async () => {
      const req = createMockReq(mockUsers.anonymous())
      const result = await ClinicMedia.access!.read!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user))
      expect(result).toBe(false)
    })
  })

  describe('Create Access', () => {
    test('Platform can create for any clinic', async () => {
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(mockUsers.platform(), {
          extra: { data: { clinic: mockClinicId } },
        }),
      )
      expect(can).toBe(true)
    })

    test('Clinic staff can create only for their assigned clinic', async () => {
      const user = mockUsers.clinic(2, mockClinicId)
      const req = createMockReq(user, payload)
      // getUserAssignedClinicId will be called if clinicId not present in user; our mockUsers include clinicId
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, {
          payload,
          extra: { data: { clinic: mockClinicId } },
        }),
      )
      expect(can).toBe(true)
    })

    test('Clinic staff cannot create for other clinics', async () => {
      const user = mockUsers.clinic(2, 999)
      const req = createMockReq(user, payload)
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, {
          payload,
          extra: { data: { clinic: mockClinicId } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', async () => {
      const req = createMockReq(mockUsers.anonymous(), payload)
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, {
          payload,
          extra: { data: { clinic: mockClinicId } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Clinic staff without assignment cannot create (no clinicId resolved)', async () => {
      // User without clinicId forces getUserAssignedClinicId path; mock find -> empty to simulate no approved profile
      const user = { ...mockUsers.clinic(2), clinicId: undefined }
      const req = createMockReq(user, payload)
      payload.find.mockResolvedValueOnce({ docs: [] })
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, {
          payload,
          extra: { data: { clinic: mockClinicId } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Clinic staff cannot create when data.clinic is missing', async () => {
      const user = mockUsers.clinic(2, mockClinicId)
      const req = createMockReq(user, payload)
      const can = await ClinicMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, {
          payload,
          extra: { data: {} },
        }),
      )
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access (scoped)', () => {
    test('Platform can update/delete any', async () => {
      const req = createMockReq(mockUsers.platform(), payload)
      const updateScope = await ClinicMedia.access!.update!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload }),
      )
      const deleteScope = await ClinicMedia.access!.delete!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload }),
      )
      expect(updateScope).toBe(true)
      expect(deleteScope).toBe(true)
    })

    test('Clinic staff scoped to their clinic', async () => {
      const req = createMockReq(mockUsers.clinic(2, mockClinicId), payload)
      // Mock getUserAssignedClinicId lookup path: simulate payload.find returning assigned clinic
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const updateScope = await ClinicMedia.access!.update!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload }),
      )
      // For delete we need another call
      payload.find.mockResolvedValueOnce({ docs: [{ clinic: mockClinicId }] })
      const deleteScope = await ClinicMedia.access!.delete!(
        createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload }),
      )
      expect(updateScope).toEqual({ clinic: { equals: mockClinicId } })
      expect(deleteScope).toEqual({ clinic: { equals: mockClinicId } })
    })

    test('Other roles cannot update/delete', async () => {
      const patientReq = createMockReq(mockUsers.patient(), payload)
      const anonReq = createMockReq(mockUsers.anonymous(), payload)
      expect(
        await ClinicMedia.access!.update!(
          createAccessArgs<AccessArgs<typeof ClinicMedia>>(patientReq.user, { payload }),
        ),
      ).toBe(false)
      expect(
        await ClinicMedia.access!.delete!(
          createAccessArgs<AccessArgs<typeof ClinicMedia>>(patientReq.user, { payload }),
        ),
      ).toBe(false)
      expect(
        await ClinicMedia.access!.update!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(anonReq.user, { payload })),
      ).toBe(false)
      expect(
        await ClinicMedia.access!.delete!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(anonReq.user, { payload })),
      ).toBe(false)
    })

    test('Clinic staff without assignment cannot update/delete', async () => {
      const user = { ...mockUsers.clinic(2), clinicId: undefined }
      const req = createMockReq(user, payload)
      // Simulate no approved clinicStaff profile
      payload.find.mockResolvedValueOnce({ docs: [] })
      expect(
        await ClinicMedia.access!.update!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload })),
      ).toBe(false)
      payload.find.mockResolvedValueOnce({ docs: [] })
      expect(
        await ClinicMedia.access!.delete!(createAccessArgs<AccessArgs<typeof ClinicMedia>>(req.user, { payload })),
      ).toBe(false)
    })
  })
})
