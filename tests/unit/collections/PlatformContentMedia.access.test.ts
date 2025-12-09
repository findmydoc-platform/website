/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, test, expect } from 'vitest'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { createMockReq } from '../helpers/testHelpers'
import { mockUsers } from '../helpers/mockUsers'

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
      const res = PlatformContentMedia.access!.read!({ req } as any)
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
      const res = PlatformContentMedia.access!.create!({ req } as any)
      expect(res).toBe(expected)
    })

    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: false },
      { label: 'Patient', user: mockUsers.patient(), expected: false },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: false },
    ])('$label user update?', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.update!({ req } as any)
      expect(res).toBe(expected)
    })

    test.each([
      { label: 'Platform', user: mockUsers.platform(), expected: true },
      { label: 'Clinic', user: mockUsers.clinic(), expected: false },
      { label: 'Patient', user: mockUsers.patient(), expected: false },
      { label: 'Anonymous', user: mockUsers.anonymous(), expected: false },
    ])('$label user delete?', ({ user, expected }) => {
      const req = createMockReq(user)
      const res = PlatformContentMedia.access!.delete!({ req } as any)
      expect(res).toBe(expected)
    })
  })
})
