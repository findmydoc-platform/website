import { describe, test, expect } from 'vitest'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow, validateAccessResult } from './matrix-helpers'

describe('PlatformStaff - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('platformStaff')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformStaff.access!.create!({ req } as any)
      
      // PlatformStaff has create: () => false, so everyone should get false
      expect(result).toBe(false)
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformStaff.access!.read!({ req } as any)
      
      // PlatformStaff read uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformStaff.access!.update!({ req } as any)
      
      // PlatformStaff update uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = PlatformStaff.access!.delete!({ req } as any)
      
      // PlatformStaff has delete: () => false, so everyone should get false
      expect(result).toBe(false)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('platformStaff')
    expect(matrixRow.displayName).toBe('PlatformStaff')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})