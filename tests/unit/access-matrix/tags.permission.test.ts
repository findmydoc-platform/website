import { describe, test, expect } from 'vitest'
import { Tags } from '@/collections/Tags'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Tags - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('tags')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('tags', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Tags.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Tags.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Tags.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Tags.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('tags')
    expect(matrixRow.displayName).toBe('Tags')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
