import { describe, test, expect } from 'vitest'
import { Cities } from '@/collections/Cities'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Cities - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('cities')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('cities', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Cities.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Cities.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Cities.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Cities.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('cities')
    expect(matrixRow.displayName).toBe('Cities')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
