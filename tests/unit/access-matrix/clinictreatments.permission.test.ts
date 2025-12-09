import { describe, test, expect } from 'vitest'
import { ClinicTreatments } from '@/collections/ClinicTreatments'
import { buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicTreatments - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinictreatments')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    test.each(userMatrix)(
      '%s create access',
      createMatrixAccessTest('clinictreatments', 'create', ClinicTreatments.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      createMatrixAccessTest('clinictreatments', 'read', ClinicTreatments.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      createMatrixAccessTest('clinictreatments', 'update', ClinicTreatments.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      createMatrixAccessTest('clinictreatments', 'delete', ClinicTreatments.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinictreatments')
    expect(matrixRow.displayName).toBe('ClinicTreatments')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
