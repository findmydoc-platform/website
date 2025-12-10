import { describe, test, expect } from 'vitest'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { createAccessArgs, createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'
import type { AccessArgs } from 'payload'

/**
 * Access expectations:
 *  - read: public (anyone)
 *  - create/update/delete: platform basic users only
 */

describe('PlatformContentMedia Collection Access Control', () => {
  describe('Read Access', () => {
    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: true },
      { label: 'Patient', user: mockUsers.patient(), expected: true },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: true },
    ])('$label user can read? $expected', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.read!(
        createAccessArgs<AccessArgs<typeof PlatformContentMedia>>(req.user),
      )
      expect(res).toBe(expected)
    })
  })

  describe('Mutating Access', () => {
    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: false },
      { label: 'Patient', user: mockUsers.patient(), expected: false },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: false },
    ])('$label user create?', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.create!(
        createAccessArgs<AccessArgs<typeof PlatformContentMedia>>(req.user),
      )
      expect(res).toBe(expected)
    })

    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: false },
      { label: 'Patient', user: mockUsers.patient(), expected: false },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: false },
    ])('$label user update?', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.update!(
        createAccessArgs<AccessArgs<typeof PlatformContentMedia>>(req.user),
      )
      expect(res).toBe(expected)
    })

    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: false },
      { label: 'Patient', user: mockUsers.patient(), expected: false },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: false },
    ])('$label user delete?', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.delete!(
        createAccessArgs<AccessArgs<typeof PlatformContentMedia>>(req.user),
      )
      expect(res).toBe(expected)
    })
  })
})
