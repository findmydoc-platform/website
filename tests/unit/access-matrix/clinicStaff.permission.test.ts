import { describe, test, expect } from 'vitest'
import { ClinicStaff } from '@/collections/ClinicStaff'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicStaff - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicStaff')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinicStaff', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', ClinicStaff.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)('%s read access', makeTest('read', ClinicStaff.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', ClinicStaff.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', ClinicStaff.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicStaff')
    expect(matrixRow.displayName).toBe('ClinicStaff')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
