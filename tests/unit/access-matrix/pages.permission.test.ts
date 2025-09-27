import { describe, test, expect } from 'vitest'
import { Pages } from '@/collections/Pages'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('Pages - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('pages')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Pages.access!.create!({ req } as any)
      
      // Pages create uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Pages.access!.read!({ req } as any)
      
      // Pages read uses platformOnlyOrPublished
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        // Non-platform users get published content filter
        expect(result).toEqual({ _status: { equals: 'published' } })
      }
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Pages.access!.update!({ req } as any)
      
      // Pages update uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Pages.access!.delete!({ req } as any)
      
      // Pages delete uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('pages')
    expect(matrixRow.displayName).toBe('Pages')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})