import { describe, test, expect } from 'vitest'
import { Accreditation } from '@/collections/Accreditation'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Accreditation - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('accreditation')
  
  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('accreditation', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Accreditation.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Accreditation.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Accreditation.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Accreditation.access!.delete!, matrixRow.operations.delete))
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('accreditation')
    expect(matrixRow.displayName).toBe('Accreditation')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
