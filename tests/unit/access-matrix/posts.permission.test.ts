import { describe, test, expect } from 'vitest'
import { Posts } from '@/collections/Posts'
import { createMockReq } from '../helpers/testHelpers'
import { buildOperationArgs, buildUserMatrix, getMatrixRow, validateAccessResult, UserType } from './matrix-helpers'

describe('Posts - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('posts')

  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest =
      (operation: 'create' | 'read' | 'update' | 'delete', accessFn: (args: any) => any, expectation: any) =>
      async (_description: string, user: any, userType: UserType) => {
        const req = createMockReq(user)
        const operationArgs = buildOperationArgs('posts', operation, userType, user)
        const accessArgs: any = { req }
        if (operationArgs?.data !== undefined) accessArgs.data = operationArgs.data
        if (operationArgs?.id !== undefined) accessArgs.id = operationArgs.id
        const result = await accessFn(accessArgs)

        await validateAccessResult({
          collectionSlug: 'posts',
          operation,
          expectation,
          userType,
          user,
          result,
          req,
          args: operationArgs,
        })
      }

    test.each(userMatrix)('%s create access', makeTest('create', Posts.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Posts.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Posts.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Posts.access!.delete!, matrixRow.operations.delete))
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
