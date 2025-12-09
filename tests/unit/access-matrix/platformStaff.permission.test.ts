import { describe, test, expect } from 'vitest'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('PlatformStaff - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('platformStaff')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('platformStaff', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', PlatformStaff.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)('%s read access', makeTest('read', PlatformStaff.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', PlatformStaff.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', PlatformStaff.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('platformStaff')
    expect(matrixRow.displayName).toBe('PlatformStaff')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
