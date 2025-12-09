import { describe, test, expect } from 'vitest'
import { DoctorSpecialties } from '@/collections/DoctorSpecialties'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('DoctorSpecialties - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('doctorspecialties')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('doctorspecialties', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', DoctorSpecialties.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', DoctorSpecialties.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', DoctorSpecialties.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', DoctorSpecialties.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('doctorspecialties')
    expect(matrixRow.displayName).toBe('DoctorSpecialties')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
