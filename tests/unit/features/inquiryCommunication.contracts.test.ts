import { describe, expect, it } from 'vitest'

import {
  inquiryStateInputSchema,
  isAllowedClinicHandlingStatusTransition,
} from '@/features/inquiryCommunication/contracts'

describe('inquiry communication contracts', () => {
  it('never accepts submitted as a handling-status command target', () => {
    expect(
      inquiryStateInputSchema.safeParse({
        action: 'set-handling-status',
        expectedRevision: 2,
        handlingStatus: 'submitted',
        inquiryId: 'inquiry-1',
      }).success,
    ).toBe(false)
  })

  it.each([
    ['submitted', 'in_review', true],
    ['submitted', 'contacted', true],
    ['in_review', 'contacted', true],
    ['contacted', 'in_review', true],
    ['submitted', 'submitted', false],
    ['in_review', 'in_review', false],
    ['contacted', 'contacted', false],
    ['in_review', 'submitted', false],
    ['contacted', 'submitted', false],
    ['spam', 'in_review', false],
  ] as const)('enforces the explicit handling transition %s -> %s', (from, to, allowed) => {
    expect(isAllowedClinicHandlingStatusTransition(from, to)).toBe(allowed)
  })
})
