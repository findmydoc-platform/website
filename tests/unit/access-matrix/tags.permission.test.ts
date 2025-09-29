import { describe, test, expect } from 'vitest'
import { Tags } from '@/collections/Tags'
import { createMockReq } from '../helpers/testHelpers'
import { buildOperationArgs, buildUserMatrix, getMatrixRow, validateAccessResult, UserType } from './matrix-helpers'

describe('Tags - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('tags')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest =
      (operation: 'create' | 'read' | 'update' | 'delete', accessFn: (args: any) => any, expectation: any) =>
      async (_description: string, user: any, userType: UserType) => {
        const req = createMockReq(user)
        const operationArgs = buildOperationArgs('tags', operation, userType, user)
        const accessArgs: any = { req }
        if (operationArgs?.data !== undefined) accessArgs.data = operationArgs.data
        if (operationArgs?.id !== undefined) accessArgs.id = operationArgs.id
        const result = await accessFn(accessArgs)

        await validateAccessResult({
          collectionSlug: 'tags',
          operation,
          expectation,
          userType,
          user,
          result,
          req,
          args: operationArgs,
        })
      }

    test.each(userMatrix)('%s create access', makeTest('create', Tags.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Tags.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Tags.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Tags.access!.delete!, matrixRow.operations.delete))
  })

  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('tags')
    expect(matrixRow.displayName).toBe('Tags')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})
