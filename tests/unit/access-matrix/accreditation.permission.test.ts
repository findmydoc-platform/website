import { describe, test, expect } from 'vitest'
import { Accreditation } from '@/collections/Accreditation'
import { createMockReq } from '../helpers/testHelpers'
import { buildOperationArgs, buildUserMatrix, getMatrixRow, validateAccessResult, UserType } from './matrix-helpers'

describe('Accreditation - Permission Matrix Compliance', () => {
  const matrixRow = getMatrixRow('accreditation')
  
  describe('access control', () => {
    const userMatrix = buildUserMatrix()

    const makeTest = (
      operation: 'create' | 'read' | 'update' | 'delete',
      accessFn: (args: any) => any,
      expectation: any,
    ) =>
      async (_description: string, user: any, userType: UserType) => {
        const req = createMockReq(user)
        const operationArgs = buildOperationArgs('accreditation', operation, userType, user)
        const accessArgs: any = { req }
        if (operationArgs?.data !== undefined) accessArgs.data = operationArgs.data
        if (operationArgs?.id !== undefined) accessArgs.id = operationArgs.id
        const result = accessFn(accessArgs)

        await validateAccessResult({
          collectionSlug: 'accreditation',
          operation,
          expectation,
          userType,
          user,
          result,
          req,
          args: operationArgs,
        })
      }

    test.each(userMatrix)('%s create access', makeTest('create', Accreditation.access!.create!, matrixRow.operations.create))
    test.each(userMatrix)('%s read access', makeTest('read', Accreditation.access!.read!, matrixRow.operations.read))
    test.each(userMatrix)('%s update access', makeTest('update', Accreditation.access!.update!, matrixRow.operations.update))
    test.each(userMatrix)('%s delete access', makeTest('delete', Accreditation.access!.delete!, matrixRow.operations.delete))
  })
  
  test('matrix row verification', () => {
    expect(matrixRow.slug).toBe('accreditation')
    expect(matrixRow.displayName).toBe('Accreditation')
    expect(matrixRow.operations).toBeDefined()
    expect(matrixRow.operations.create).toBeDefined()
    expect(matrixRow.operations.read).toBeDefined()
    expect(matrixRow.operations.update).toBeDefined()
    expect(matrixRow.operations.delete).toBeDefined()
  })
})