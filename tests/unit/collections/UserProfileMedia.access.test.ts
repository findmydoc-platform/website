import { describe, test, expect, vi, beforeEach } from 'vitest'
import { UserProfileMedia } from '@/collections/UserProfileMedia'
import { createAccessArgs, createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import type { AccessArgs, Where } from 'payload'

/** UserProfileMedia Access Summary
 *  read: platform -> true; owner -> polymorphic filter; others -> false
 *  create: platform -> true; owner only if user field matches self; others -> false
 *  update/delete: platform -> true; owner -> filter; others -> false
 */

describe('UserProfileMedia Collection Access Control', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  function expectOwnerFilter(result: Where, collection: 'basicUsers' | 'patients', id: number) {
    const key = `user.${collection}.id`
    expect(result).toEqual({ [key]: { equals: id } })
  }

  describe('Read Access', () => {
    test('Platform can read all', () => {
      const req = createMockReq(mockUsers.platform())
      const res = UserProfileMedia.access!.read!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))
      expect(res).toBe(true)
    })

    test('BasicUser owner scoped filter (clinic staff)', () => {
      const user = mockUsers.clinic() // non-platform basic user
      const req = createMockReq(user)
      const res = UserProfileMedia.access!.read!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      expectOwnerFilter(res, 'basicUsers', user.id)
    })

    test('Patient owner scoped filter', () => {
      const patient = mockUsers.patient()
      const pid = Number(patient.id)
      const req = createMockReq({ ...patient, id: pid })
      const res = UserProfileMedia.access!.read!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      expectOwnerFilter(res, 'patients', pid)
    })

    test.each([{ label: 'Anonymous', user: mockUsers.anonymous() }])('$label cannot read', ({ user }) => {
      const req = createMockReq(user)
      const res = UserProfileMedia.access!.read!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))
      expect(res).toBe(false)
    })
  })

  describe('Create Access', () => {
    test('Platform can create', () => {
      const req = createMockReq(mockUsers.platform())
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, {
          extra: { data: { user: { relationTo: 'basicUsers', value: 1 } } },
        }),
      )
      expect(can).toBe(true)
    })

    test('BasicUser (clinic staff) can create for self', () => {
      const user = mockUsers.clinic()
      const req = createMockReq(user)
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, {
          extra: { data: { user: { relationTo: 'basicUsers', value: user.id } } },
        }),
      )
      expect(can).toBe(true)
    })

    test('BasicUser (clinic staff) cannot create for different user', () => {
      const user = mockUsers.clinic()
      const req = createMockReq(user)
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, {
          extra: { data: { user: { relationTo: 'basicUsers', value: 9999 } } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Patient can create for self', () => {
      const patient = mockUsers.patient()
      const pid = Number(patient.id)
      const req = createMockReq({ ...patient, id: pid })
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, {
          extra: { data: { user: { relationTo: 'patients', value: pid } } },
        }),
      )
      expect(can).toBe(true)
    })

    test('Patient cannot create for another patient', () => {
      const patient = mockUsers.patient()
      const pid = Number(patient.id)
      const req = createMockReq({ ...patient, id: pid })
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, {
          extra: { data: { user: { relationTo: 'patients', value: pid + 111 } } },
        }),
      )
      expect(can).toBe(false)
    })

    test('Anonymous cannot create', () => {
      const req = createMockReq(mockUsers.anonymous())
      const can = UserProfileMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user, { extra: { data: {} } }),
      )
      expect(can).toBe(false)
    })
  })

  describe('Update/Delete Access', () => {
    test('Platform full access', () => {
      const req = createMockReq(mockUsers.platform())
      expect(UserProfileMedia.access!.update!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))).toBe(
        true,
      )
      expect(UserProfileMedia.access!.delete!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))).toBe(
        true,
      )
    })

    test('Owner (basic user clinic staff) scoped for update/delete', () => {
      const user = mockUsers.clinic()
      const req = createMockReq(user)
      const updateScope = UserProfileMedia.access!.update!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      const deleteScope = UserProfileMedia.access!.delete!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      expectOwnerFilter(updateScope, 'basicUsers', user.id)
      expectOwnerFilter(deleteScope, 'basicUsers', user.id)
    })

    test('Owner (patient) scoped for update/delete', () => {
      const patient = mockUsers.patient()
      const pid = Number(patient.id)
      const req = createMockReq({ ...patient, id: pid })
      const updateScope = UserProfileMedia.access!.update!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      const deleteScope = UserProfileMedia.access!.delete!(
        createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user),
      ) as Where
      expectOwnerFilter(updateScope, 'patients', pid)
      expectOwnerFilter(deleteScope, 'patients', pid)
    })

    test.each([{ label: 'Anonymous', user: mockUsers.anonymous() }])('$label cannot mutate', ({ user }) => {
      const req = createMockReq(user)
      expect(UserProfileMedia.access!.update!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))).toBe(
        false,
      )
      expect(UserProfileMedia.access!.delete!(createAccessArgs<AccessArgs<typeof UserProfileMedia>>(req.user))).toBe(
        false,
      )
    })
  })
})
