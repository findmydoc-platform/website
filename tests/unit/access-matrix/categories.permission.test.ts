import { describe, test, expect } from 'vitest'
import { Categories } from '@/collections/Categories'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Categories - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('categories')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('categories', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', Categories.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)('%s read access', makeTest('read', Categories.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', Categories.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', Categories.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('categories')
    expect(matrixRow.displayName).toBe('Categories')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
