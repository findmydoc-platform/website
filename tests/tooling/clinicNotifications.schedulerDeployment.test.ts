import { describe, expect, it } from 'vitest'
import website from '../../vercel.json'
import scheduler from '../../apps/preview-email-scheduler/vercel.json'
describe('independent five-minute notification schedules', () => {
  it('schedules Production on its dedicated path', () => {
    expect(website.crons.filter(({ path }) => path.includes('clinic-notifications'))).toEqual([
      { path: '/api/internal/clinic-notifications/retention', schedule: '*/5 * * * *' },
    ])
  })
  it('schedules a separate Preview relay independently of email ticks', () => {
    expect(scheduler.crons).toEqual([
      { path: '/api/tick', schedule: '* * * * *' },
      { path: '/api/notifications', schedule: '*/5 * * * *' },
    ])
    expect(scheduler.functions['api/notifications.js'].maxDuration).toBe(300)
  })
})
