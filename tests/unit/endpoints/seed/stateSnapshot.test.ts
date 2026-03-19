import { describe, expect, it } from 'vitest'

import { buildSeedRunSnapshot, createSeedRunRecord } from '@/endpoints/seed/utils/state'

describe('seed run snapshot status reconstruction', () => {
  it('keeps a failed run failed when queueing stops before job records exist', () => {
    const record = createSeedRunRecord({
      runId: 'run-1',
      type: 'baseline',
      reset: false,
      queue: 'seed:run-1',
      totalJobs: 15,
    })

    record.status = 'failed'
    record.completedAt = '2026-03-19T10:05:25.000Z'
    record.failures.push('Unable to queue seed run: insert into payload_jobs failed')

    const snapshot = buildSeedRunSnapshot(record)

    expect(snapshot.status).toBe('failed')
    expect(snapshot.progress).toEqual({
      completed: 0,
      total: 15,
      percent: 0,
    })
    expect(snapshot.jobIds).toEqual([])
    expect(snapshot.hasActiveJob).toBe(false)
  })
})
