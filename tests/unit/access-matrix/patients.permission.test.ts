import { describe, test, expect } from 'vitest'
import { Patients } from '@/collections/Patients'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Patients - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('patients')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('patients', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', Patients.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Patients.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Patients.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Patients.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('patients')
    expect(matrixRow.displayName).toBe('Patients')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
