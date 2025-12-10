import { describe, test, expect } from 'vitest'
import { Reviews } from '@/collections/Reviews'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Reviews - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('reviews')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('reviews', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Reviews.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Reviews.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Reviews.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Reviews.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('reviews')
    expect(matrixRow.displayName).toBe('Reviews')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
