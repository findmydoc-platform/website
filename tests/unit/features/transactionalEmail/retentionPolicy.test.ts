import { describe, expect, it } from 'vitest'
import type { TransactionalEmailOutbox } from '@/payload-types'
import { deletionEligible } from '@/features/transactionalEmail/retentionPolicy'

const terminal: TransactionalEmailOutbox = {
  id: 1,
  commandType: 'clinic.registration-received',
  operationReference: 'synthetic-registration',
  runtimeEnvironment: 'test',
  state: 'accepted',
  providerIdempotencyKey: 'synthetic-idempotency',
  recipientDigest: 'synthetic-digest',
  latestEventSequence: 2,
  terminalAt: '2026-09-01T00:00:00.000Z',
  scrubbedAt: '2026-09-01T00:00:00.000Z',
  createdAt: '2026-08-31T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
}

describe('transactional email history deletion eligibility', () => {
  it.each<TransactionalEmailOutbox['state']>([
    'accepted',
    'delivered',
    'suppressed',
    'bounced',
    'complained',
    'failed',
    'expired',
  ])('retains %s history before day 28 and allows deletion exactly at the boundary', (state) => {
    const record = { ...terminal, state }
    expect(deletionEligible(record, Date.parse('2026-09-28T23:59:59.999Z'))).toBe(false)
    expect(deletionEligible(record, Date.parse('2026-09-29T00:00:00.000Z'))).toBe(true)
  })

  it.each<TransactionalEmailOutbox['state']>(['queued', 'prepared'])(
    'does not delete unfinished %s operations even with old terminal timestamps',
    (state) => {
      expect(deletionEligible({ ...terminal, state }, Date.parse('2026-10-10T00:00:00.000Z'))).toBe(false)
    },
  )

  it.each(['terminalAt', 'scrubbedAt'] as const)('requires %s before deletion', (field) => {
    expect(deletionEligible({ ...terminal, [field]: null }, Date.parse('2026-10-10T00:00:00.000Z'))).toBe(false)
  })

  it('allows deletion of existing history between 28 and 42 days old', () => {
    expect(deletionEligible(terminal, Date.parse('2026-10-06T00:00:00.000Z'))).toBe(true)
  })

  it('uses the original terminal timestamp rather than later metadata activity', () => {
    expect(
      deletionEligible(
        { ...terminal, updatedAt: '2026-09-28T00:00:00.000Z', scrubbedAt: '2026-09-28T00:00:00.000Z' },
        Date.parse('2026-09-29T00:00:00.000Z'),
      ),
    ).toBe(true)
  })
})
