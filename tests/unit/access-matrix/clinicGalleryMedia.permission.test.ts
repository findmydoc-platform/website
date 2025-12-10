import { describe, test, expect } from 'vitest'
import { ClinicGalleryMedia } from '@/collections/ClinicGalleryMedia'
import { AccessExpectation, AccessFn, buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('ClinicGalleryMedia - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('clinicGalleryMedia')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: AccessFn,
      expectation: AccessExpectation,
    ) => createMatrixAccessTest('clinicGalleryMedia', operation, accessFn, expectation)

    test.each(userMatrix)(
      '%s create access',
      makeTest('create', ClinicGalleryMedia.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      makeTest('read', ClinicGalleryMedia.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      makeTest('update', ClinicGalleryMedia.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      makeTest('delete', ClinicGalleryMedia.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('clinicGalleryMedia')
    expect(matrixRow.displayName).toBe('ClinicGalleryMedia')
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
