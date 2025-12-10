import { describe, test, expect } from 'vitest'
import { Doctors } from '@/collections/Doctors'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Doctors - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('doctors')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('doctors', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Doctors.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Doctors.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Doctors.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Doctors.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('doctors')
    expect(matrixRow.displayName).toBe('Doctors')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
