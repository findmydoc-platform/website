import { describe, expect, it } from 'vitest'
import { createAdminDashboardConfig } from '@/dashboard/adminDashboard/config'

describe('createAdminDashboardConfig', () => {
  it('always registers the developer seeding widget', () => {
    const config = createAdminDashboardConfig({
      ...process.env,
      FEATURE_DEVELOPER_DASHBOARD: 'false',
    })

    expect(config.widgets).toHaveLength(1)
    expect(config.widgets[0]?.slug).toBe('developer-seeding')
    expect(config.defaultLayout).toContainEqual({ widgetSlug: 'developer-seeding', width: 'full' })
  })
})
