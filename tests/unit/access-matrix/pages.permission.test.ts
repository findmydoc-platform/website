import { describe, test, expect } from 'vitest'
import { Pages } from '@/collections/Pages'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Pages - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('pages')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('pages', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Pages.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Pages.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Pages.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Pages.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('pages')
    expect(matrixRow.displayName).toBe('Pages')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
