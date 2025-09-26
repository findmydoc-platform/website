import { describe, test, expect } from 'vitest'
import { Doctors } from '@/collections/Doctors'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow, getExpectedBoolean, shouldReturnScopeFilter, getExpectedScopeFilter } from './matrix-helpers'

describe('Doctors - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('doctors')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const expected = getExpectedBoolean(matrixRow.operations.read, userType)
      expect(Doctors.access!.read!({ req } as any)).toBe(expected)
    })

    // Create, update, delete are more complex for doctors - they have conditional access
    test('platform staff has full create access', () => {
      const req = createMockReq(mockUsers.platform())
      expect(Doctors.access!.create!({ req } as any)).toBe(true)
    })

    test('clinic staff has conditional create access', () => {
      const user = mockUsers.clinic()
      const req = createMockReq(user)
      const result = Doctors.access!.create!({ req } as any)
      
      // Should either return true (if allowed) or a scope filter
      if (shouldReturnScopeFilter(matrixRow.operations.create)) {
        expect(typeof result).toBe('object')
        expect(result).toBeTruthy()
      } else {
        expect(result).toBe(getExpectedBoolean(matrixRow.operations.create, 'clinic'))
      }
    })

    test('platform staff has full update access', () => {
      const req = createMockReq(mockUsers.platform())
      expect(Doctors.access!.update!({ req } as any)).toBe(true)
    })

    test('clinic staff has conditional update access', () => {
      const user = mockUsers.clinic()
      const req = createMockReq(user)
      const result = Doctors.access!.update!({ req } as any)
      
      // Should either return true (if allowed) or a scope filter
      if (shouldReturnScopeFilter(matrixRow.operations.update)) {
        expect(typeof result).toBe('object')
        expect(result).toBeTruthy()
      } else {
        expect(result).toBe(getExpectedBoolean(matrixRow.operations.update, 'clinic'))
      }
    })

    test('non-platform users cannot delete', () => {
      const clinicReq = createMockReq(mockUsers.clinic())
      const patientReq = createMockReq(mockUsers.patient())
      const anonymousReq = createMockReq(null)

      expect(Doctors.access!.delete!({ req: clinicReq } as any)).toBe(false)
      expect(Doctors.access!.delete!({ req: patientReq } as any)).toBe(false)
      expect(Doctors.access!.delete!({ req: anonymousReq } as any)).toBe(false)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('doctors')
    expect(matrixRow.displayName).toBe('Doctors')
    expect(matrixRow.operations.read.type).toBe('anyone')
    expect(matrixRow.operations.create.type).toBe('conditional')
    expect(matrixRow.operations.update.type).toBe('conditional')
  })
})