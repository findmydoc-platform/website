import { describe, test, expect } from 'vitest'
import { Posts } from '@/collections/Posts'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('Posts - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('posts')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Posts.access!.create!({ req } as any)
      
      // Posts create uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Posts.access!.read!({ req } as any)
      
      // Posts read uses platformOnlyOrPublished
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        // Non-platform users get published content filter
        expect(result).toEqual({ _status: { equals: 'published' } })
      }
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Posts.access!.update!({ req } as any)
      
      // Posts update uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = Posts.access!.delete!({ req } as any)
      
      // Posts delete uses isPlatformBasicUser - only platform should get true
      if (userType === 'platform') {
        expect(result).toBe(true)
      } else {
        expect(result).toBe(false)
      }
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('posts')
    expect(matrixRow.displayName).toBe('Posts')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})