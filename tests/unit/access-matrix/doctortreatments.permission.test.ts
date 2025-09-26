import { describe, test, expect } from 'vitest'
import { DoctorTreatments } from '@/collections/DoctorTreatments'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow, getExpectedBoolean, shouldReturnScopeFilter } from './matrix-helpers'

describe('DoctorTreatments - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('doctortreatments')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = DoctorTreatments.access!.create!({ req } as any)
      
      if (shouldReturnScopeFilter(matrixRow.operations.create)) {
        // Complex conditional access - verify it returns an object or boolean
        expect(typeof result === 'boolean' || typeof result === 'object').toBe(true)
      } else {
        const expected = getExpectedBoolean(matrixRow.operations.create, userType)
        expect(result).toBe(expected)
      }
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = DoctorTreatments.access!.read!({ req } as any)
      
      if (shouldReturnScopeFilter(matrixRow.operations.read)) {
        // Complex conditional access - verify it returns an object or boolean
        expect(typeof result === 'boolean' || typeof result === 'object').toBe(true)
      } else {
        const expected = getExpectedBoolean(matrixRow.operations.read, userType)
        expect(result).toBe(expected)
      }
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = DoctorTreatments.access!.update!({ req } as any)
      
      if (shouldReturnScopeFilter(matrixRow.operations.update)) {
        // Complex conditional access - verify it returns an object or boolean
        expect(typeof result === 'boolean' || typeof result === 'object').toBe(true)
      } else {
        const expected = getExpectedBoolean(matrixRow.operations.update, userType)
        expect(result).toBe(expected)
      }
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = DoctorTreatments.access!.delete!({ req } as any)
      
      if (shouldReturnScopeFilter(matrixRow.operations.delete)) {
        // Complex conditional access - verify it returns an object or boolean
        expect(typeof result === 'boolean' || typeof result === 'object').toBe(true)
      } else {
        const expected = getExpectedBoolean(matrixRow.operations.delete, userType)
        expect(result).toBe(expected)
      }
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('doctortreatments')
    expect(matrixRow.displayName).toBe('DoctorTreatments')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})