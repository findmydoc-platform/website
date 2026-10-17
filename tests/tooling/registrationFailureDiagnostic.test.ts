import { describe, expect, it } from 'vitest'
import { registrationFailureDiagnostic } from '../../scripts/testing/registration-failure-diagnostic'
describe('Controlled registration failure diagnostic', () => {
  it('retains only closed classification fields from the error cause and validation chain', () => {
    const input = {
      code: 'clinic-registration-unavailable',
      message: 'submitted-private-data',
      cause: {
        code: '23505',
        constraint: 'commandType_operationReference_idx',
        query: 'private SQL',
        data: {
          collection: 'transactionalEmailOutbox',
          errors: [{ path: 'command_type, operation_reference', value: 'private value' }],
        },
      },
    }
    expect(registrationFailureDiagnostic(input)).toEqual([
      { code: 'clinic-registration-unavailable' },
      { code: '23505', constraint: 'commandType_operationReference_idx' },
      { collection: 'transactionalEmailOutbox' },
      { path: 'command_type, operation_reference' },
    ])
  })
  it('redacts unrecognized classification values and bounds cyclic causes', () => {
    const input: Record<string, unknown> = {
      code: 'private submitted code',
      collection: 'private collection',
      path: 'private path',
      constraint: 'private constraint',
    }
    input.cause = input
    expect(registrationFailureDiagnostic(input)).toEqual([
      { code: 'unrecognized', constraint: 'unrecognized', collection: 'unrecognized', path: 'unrecognized' },
    ])
  })
})
