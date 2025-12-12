import { describe, test, expect, vi, beforeEach } from 'vitest'
import { DoctorMedia } from '@/collections/DoctorMedia'
import { createAccessArgs, createMockReq, createMockPayload } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import type { AccessArgs } from 'payload'
import type { MockPayload } from '../helpers/testHelpers'
import type { DoctorMedia as DoctorMediaDoc } from '@/payload-types'

/** DoctorMedia Access Rules Summary:
 *  read: platform -> true, clinic staff -> scoped filter, others -> false
 *  create: platform -> true; clinic staff only if doctor belongs to their clinic
 *  update/delete: platform -> true; clinic staff -> scoped filter; others false
 */

describe('DoctorMedia Collection Access Control', () => {
  let mockPayload: MockPayload
  const clinicId = 77
  const otherClinicId = 99

  beforeEach(() => {
    mockPayload = createMockPayload()
    vi.resetAllMocks()
  })

  describe('Read Access', () => {
    test('Platform can read all', async () => {
      const res = await DoctorMedia.access!.read!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(mockUsers.platform(), { payload: mockPayload }),
      )
      expect(res).toBe(true)
    })

    test('Clinic staff scoped to clinic', async () => {
      const req = createMockReq(mockUsers.clinic(10, clinicId), mockPayload)
      vi.mocked(mockPayload.find).mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const res = (await DoctorMedia.access!.read!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
      )) as unknown
      expect(res).toEqual({ clinic: { equals: clinicId } })
    })

    test('Clinic staff without assignment denied', async () => {
      const user = { ...mockUsers.clinic(10), clinicId: undefined }
      const req = createMockReq(user, mockPayload)
      vi.mocked(mockPayload.find).mockResolvedValueOnce({ docs: [] })
      const res = await DoctorMedia.access!.read!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
      )
      expect(res).toBe(false)
    })

    test.each([
      { label: 'Patient', user: mockUsers.patient() },
      { label: 'Anonymous', user: mockUsers.anonymous() },
    ])('$label cannot read', async ({ user }) => {
      const req = createMockReq(user, mockPayload)
      const res = await DoctorMedia.access!.read!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
      )
      expect(res).toBe(false)
    })
  })

  describe('Create Access', () => {
    test('Platform can create for any doctor', async () => {
      const can = await DoctorMedia.access!.create!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(mockUsers.platform(), {
          payload: mockPayload,
          extra: { data: { doctor: 123 } },
        }),
      )
      expect(can).toBe(true)
    })

    test('Clinic staff can create if doctor belongs to their clinic', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), mockPayload)
      // getDoctorClinicId -> payload.findByID invoked; we mock via a helper method pattern used in hook path
      vi.mocked(mockPayload.findByID).mockResolvedValueOnce({ clinic: clinicId })
      const can = await DoctorMedia.access!.create!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, {
          payload: mockPayload,
          extra: { data: { doctor: 321 } },
        }),
      )
      expect(can).toBe(true)
    })

    test('Clinic staff cannot create if doctor belongs to different clinic', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), mockPayload)
      vi.mocked(mockPayload.findByID).mockResolvedValueOnce({ clinic: otherClinicId })
      const can = await DoctorMedia.access!.create!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, {
          payload: mockPayload,
          extra: { data: { doctor: 222 } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Clinic staff missing doctor resolves false', async () => {
      const req = createMockReq(mockUsers.clinic(5, clinicId), mockPayload)
      const can = await DoctorMedia.access!.create!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, {
          payload: mockPayload,
          extra: { data: {} },
        }),
      )
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', async () => {
      const req = createMockReq(mockUsers.anonymous(), mockPayload)
      const can = await DoctorMedia.access!.create!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, {
          payload: mockPayload,
          extra: { data: { doctor: 1 } },
        }),
      )
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access', () => {
    test('Platform full access', async () => {
      const req = createMockReq(mockUsers.platform(), mockPayload)
      expect(
        await DoctorMedia.access!.update!(
          createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
        ),
      ).toBe(true)
      expect(
        await DoctorMedia.access!.delete!(
          createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
        ),
      ).toBe(true)
    })

    test('Clinic staff scoped', async () => {
      const req = createMockReq(mockUsers.clinic(3, clinicId), mockPayload)
      vi.mocked(mockPayload.find).mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const updateScope = (await DoctorMedia.access!.update!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
      )) as unknown
      vi.mocked(mockPayload.find).mockResolvedValueOnce({ docs: [{ clinic: clinicId }] })
      const deleteScope = (await DoctorMedia.access!.delete!(
        createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
      )) as unknown
      expect(updateScope).toEqual({ clinic: { equals: clinicId } })
      expect(deleteScope).toEqual({ clinic: { equals: clinicId } })
    })

    test.each([
      { label: 'Patient', user: mockUsers.patient() },
      { label: 'Anonymous', user: mockUsers.anonymous() },
    ])('$label cannot mutate', async ({ user }) => {
      const req = createMockReq(user, mockPayload)
      expect(
        await DoctorMedia.access!.update!(
          createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
        ),
      ).toBe(false)
      expect(
        await DoctorMedia.access!.delete!(
          createAccessArgs<AccessArgs<Partial<DoctorMediaDoc>>>(req.user, { payload: mockPayload }),
        ),
      ).toBe(false)
    })
  })
})
