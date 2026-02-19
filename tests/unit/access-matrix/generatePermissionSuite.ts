import { describe, expect, test } from 'vitest'
import type { Access } from 'payload'

import { buildUserMatrix, createMatrixAccessTest, getMatrixRow } from './matrix-helpers'

interface CrudAccess {
  create: Access
  read: Access
  update: Access
  delete: Access
}

export interface CollectionWithCrudAccess {
  access?: {
    create?: Access
    read?: Access
    update?: Access
    delete?: Access
  }
}

function getCrudAccess(collection: CollectionWithCrudAccess): CrudAccess {
  const access = collection.access

  if (!access) {
    throw new Error('Collection is missing an access configuration.')
  }

  const { create, read, update, delete: remove } = access

  if (typeof create !== 'function') {
    throw new Error('Collection access.create must be a function.')
  }

  if (typeof read !== 'function') {
    throw new Error('Collection access.read must be a function.')
  }

  if (typeof update !== 'function') {
    throw new Error('Collection access.update must be a function.')
  }

  if (typeof remove !== 'function') {
    throw new Error('Collection access.delete must be a function.')
  }

  return {
    create,
    read,
    update,
    delete: remove,
  }
}

export function makePermissionSuite(slug: string, collection: CollectionWithCrudAccess, displayName?: string): void {
  const matrixRow = getMatrixRow(slug)
  const suiteDisplayName = displayName ?? matrixRow.displayName
  const access = getCrudAccess(collection)

  describe(`${suiteDisplayName} - Permission Matrix Compliance`, () => {
    describe('access control', () => {
      const userMatrix = buildUserMatrix()

      test.each(userMatrix)(
        '%s create access',
        createMatrixAccessTest(slug, 'create', access.create, matrixRow.operations.create),
      )
      test.each(userMatrix)(
        '%s read access',
        createMatrixAccessTest(slug, 'read', access.read, matrixRow.operations.read),
      )
      test.each(userMatrix)(
        '%s update access',
        createMatrixAccessTest(slug, 'update', access.update, matrixRow.operations.update),
      )
      test.each(userMatrix)(
        '%s delete access',
        createMatrixAccessTest(slug, 'delete', access.delete, matrixRow.operations.delete),
      )
    })

    test('matrix row verification', () => {
      expect(matrixRow.slug).toBe(slug)
      expect(matrixRow.displayName).toBe(suiteDisplayName)
      expect(matrixRow.operations).toBeDefined()
      expect(matrixRow.operations.create).toBeDefined()
      expect(matrixRow.operations.read).toBeDefined()
      expect(matrixRow.operations.update).toBeDefined()
      expect(matrixRow.operations.delete).toBeDefined()
    })
  })
}
