import { describe, expect, it } from 'vitest'
import website from '../../vercel.json'
import scheduler from '../../apps/preview-email-scheduler/vercel.json'
import runtime from '../../apps/preview-email-scheduler/package.json'

describe('independent transactional email schedules', () => {
  it('schedules the Production Website worker in its own project once per minute', () => {
    expect(website.crons).toEqual([{ path: '/api/internal/transactional-email/worker', schedule: '* * * * *' }])
  })

  it('gives the Preview scheduler its own function, cadence, runtime and deployment root', () => {
    expect(scheduler.crons).toEqual([{ path: '/api/tick', schedule: '* * * * *' }])
    expect(scheduler.functions['api/tick.js'].maxDuration).toBe(300)
    expect(scheduler.framework).toBeNull()
    expect(runtime.engines.node).toBe('24.x')
  })
})
