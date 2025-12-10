import { describe, test, expect } from 'vitest'
import { UserProfileMedia } from '@/collections/UserProfileMedia'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('UserProfileMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('userProfileMedia')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('userProfileMedia', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', UserProfileMedia.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)('%s read access', makeTest('read', UserProfileMedia.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', UserProfileMedia.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', UserProfileMedia.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('userProfileMedia')
    expect(matrixRow.displayName).toBe('UserProfileMedia')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
