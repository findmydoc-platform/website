import { describe, test, expect } from 'vitest'
import { Posts } from '@/collections/Posts'
import { buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

describe('Posts - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('posts')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    test.each(userMatrix)(
      '%s create access',
      createMatrixAccessTest('posts', 'create', Posts.access!.create!, matrixRow.operations.create),
    )
    test.each(userMatrix)(
      '%s read access',
      createMatrixAccessTest('posts', 'read', Posts.access!.read!, matrixRow.operations.read),
    )
    test.each(userMatrix)(
      '%s update access',
      createMatrixAccessTest('posts', 'update', Posts.access!.update!, matrixRow.operations.update),
    )
    test.each(userMatrix)(
      '%s delete access',
      createMatrixAccessTest('posts', 'delete', Posts.access!.delete!, matrixRow.operations.delete),
    )
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('posts')
    expect(matrixRow.displayName).toBe('Posts')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
