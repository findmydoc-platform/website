import { describe, test, expect } from 'vitest'
import { Reviews } from '@/collections/Reviews'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('Reviews - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('reviews')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Reviews.access!.create!({ req } as any)
      
      // Reviews create allows both platform and patient
      if (userType === 'platform' || userType === 'patient') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Reviews.access!.read!({ req } as any)
      
      // Reviews read uses platformOnlyOrApprovedReviews
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        // Non-platform users get approved reviews filter
        expect(result).toEqual({ status: { equals: 'approved' } })
      }
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Reviews.access!.update!({ req } as any)
      
      // Reviews update uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Reviews.access!.delete!({ req } as any)
      
      // Reviews delete uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('reviews')
    expect(matrixRow.displayName).toBe('Reviews')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})