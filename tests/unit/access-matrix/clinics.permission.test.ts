import { describe, test, expect } from 'vitest'
import { Clinics } from '@/collections/Clinics'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Clinics - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinics')
  
  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinics', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Clinics.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Clinics.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Clinics.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Clinics.access!.delete!, matrixRow.operations.delete))
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinics')
    expect(matrixRow.displayName).toBe('Clinics')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
