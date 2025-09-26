import { describe, test, expect } from 'vitest'
import { Categories } from '@/collections/Categories'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow, getExpectedBoolean } from './matrix-helpers'

describe('Categories - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('categories')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.create, userType)
      expect(Categories.access!.create!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.read, userType)
      expect(Categories.access!.read!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.update, userType)
      expect(Categories.access!.update!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.delete, userType)
      expect(Categories.access!.delete!({ req } as any)).toBe(expected)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('categories')
    expect(matrixRow.displayName).toBe('Categories')
    expect(matrixRow.operations.create.type).toBe('platform')
    expect(matrixRow.operations.read.type).toBe('anyone')
    expect(matrixRow.operations.update.type).toBe('platform')
    expect(matrixRow.operations.delete.type).toBe('platform')
  })
})