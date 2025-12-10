import { describe, test, expect } from 'vitest'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicApplications - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicApplications')
  
  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinicApplications', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', ClinicApplications.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', ClinicApplications.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', ClinicApplications.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', ClinicApplications.access!.delete!, matrixRow.operations.delete),
    )
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicApplications')
    expect(matrixRow.displayName).toBe('ClinicApplications')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
