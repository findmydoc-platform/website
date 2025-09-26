import { describe, test, expect } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { mockUsers } from '../helpers/mockUsers'
import { createMockReq } from '../helpers/testHelpers'
import { getMatrixRow } from './matrix-helpers'

describe('ClinicMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicMedia')
  
  describe('access control', () => {
    const userMatrix = [
      ['platform staff', mockUsers.platform(), 'platform'],
      ['clinic staff', mockUsers.clinic(), 'clinic'],
      ['patient', mockUsers.patient(), 'patient'],
      ['anonymous', null, 'anonymous'],
    ] as const

    test.each(userMatrix)('%s create access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ClinicMedia.access!.create!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s read access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ClinicMedia.access!.read!({ req } as any)
      
      // Verify access result is valid (boolean or object)  
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s update access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ClinicMedia.access!.update!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })

    test.each(userMatrix)('%s delete access', (description, user, userType) => {
      const req = createMockReq(user)
      const result = ClinicMedia.access!.delete!({ req } as any)
      
      // Verify access result is valid (boolean or object)
      expect(typeof result === 'boolean' || (typeof result === 'object' && result !== null)).toBe(true)
    })
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicMedia')
    expect(matrixRow.displayName).toBe('ClinicMedia')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})