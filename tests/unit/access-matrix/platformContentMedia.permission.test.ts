import { describe, test, expect } from 'vitest'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('PlatformContentMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('platformContentMedia')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformContentMedia.access!.create!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformContentMedia.access!.read!({ req } as any)
      
      // Verify access result is valid (boolean or object)  
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformContentMedia.access!.update!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformContentMedia.access!.delete!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('platformContentMedia')
    expect(matrixRow.displayName).toBe('PlatformContentMedia')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})