import { describe, test, expect } from 'vitest'
import { Cities } from '@/collections/Cities'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow, getExpectedBoolean } from './matrix-helpers'

describe('Cities - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('cities')
  
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
      expect(Cities.access!.create!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.read, userType)
      expect(Cities.access!.read!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.update, userType)
      expect(Cities.access!.update!({ req } as any)).toBe(expected)
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.delete, userType)
      expect(Cities.access!.delete!({ req } as any)).toBe(expected)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('cities')
    expect(matrixRow.displayName).toBe('Cities')
    expect(matrixRow.operations.create.type).toBe('platform')
    expect(matrixRow.operations.read.type).toBe('anyone')
    expect(matrixRow.operations.update.type).toBe('platform')
    expect(matrixRow.operations.delete.type).toBe('platform')
  })
})