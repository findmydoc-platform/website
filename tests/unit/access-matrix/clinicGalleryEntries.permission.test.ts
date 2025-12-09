import { describe, test, expect } from 'vitest'
import { ClinicGalleryEntries } from '@/collections/ClinicGalleryEntries'
import { AccessExpectation, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicGalleryEntries - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicGalleryEntries')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: unknown) => unknown,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinicGalleryEntries', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', ClinicGalleryEntries.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', ClinicGalleryEntries.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', ClinicGalleryEntries.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', ClinicGalleryEntries.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicGalleryEntries')
    expect(matrixRow.displayName).toBe('ClinicGalleryEntries')
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
