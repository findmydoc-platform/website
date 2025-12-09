import { describe, test, expect } from 'vitest'
import { MedicalSpecialties } from '@/collections/MedicalSpecialties'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('MedicalSpecialties - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('medical-specialties')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('medical-specialties', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', MedicalSpecialties.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', MedicalSpecialties.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', MedicalSpecialties.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', MedicalSpecialties.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('medical-specialties')
    expect(matrixRow.displayName).toBe('MedicalSpecialties')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
