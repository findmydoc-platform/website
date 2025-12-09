import { describe, test, expect } from 'vitest'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('PlatformContentMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('platformContentMedia')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('platformContentMedia', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', PlatformContentMedia.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', PlatformContentMedia.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', PlatformContentMedia.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', PlatformContentMedia.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('platformContentMedia')
    expect(matrixRow.displayName).toBe('PlatformContentMedia')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
