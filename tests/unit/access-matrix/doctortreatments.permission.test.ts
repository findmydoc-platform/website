import { describe, test, expect } from 'vitest'
import { DoctorTreatments } from '@/collections/DoctorTreatments'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('DoctorTreatments - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('doctortreatments')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('doctortreatments', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', DoctorTreatments.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)('%s read access', makeTest('read', DoctorTreatments.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', DoctorTreatments.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', DoctorTreatments.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('doctortreatments')
    expect(matrixRow.displayName).toBe('DoctorTreatments')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
