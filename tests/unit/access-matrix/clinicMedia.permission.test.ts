import { describe, test, expect } from 'vitest'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicMedia')
  
  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinicMedia', operation, accessFn, expectation)

    test.each(userMatrix)('%s create access', makeTest('create', ClinicMedia.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', ClinicMedia.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', ClinicMedia.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', ClinicMedia.access!.delete!, matrixRow.operations.delete))
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicMedia')
    expect(matrixRow.displayName).toBe('ClinicMedia')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
