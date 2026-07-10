import { describe, expect, it } from 'vitest'
import { createAdminDashboardConfig } from '@/dashboard/adminDashboard/config'

describe('createAdminDashboardConfig', () => {
  it('always registers the developer seeding and cache visibility widgets', () => {
    const config = createAdminDashboardConfig({
      ...process.env,
      FEATURE_DEVELOPER_DASHBOARD: 'false',
    })

    expect(config.widgets).toHaveLength(2)
    expect(config.widgets[0]?.slug).toBe('developer-seeding')
    expect(config.widgets[0]?.Component).toBe('@/components/organisms/DeveloperDashboard')
    expect(config.widgets[1]?.slug).toBe('cache-revalidation-visibility')
    expect(config.widgets[1]?.Component).toBe('@/components/organisms/CacheRevalidationVisibility')
    expect(config.defaultLayout).toContainEqual({ widgetSlug: 'developer-seeding', width: 'full' })
    expect(config.defaultLayout).toContainEqual({ widgetSlug: 'cache-revalidation-visibility', width: 'full' })
  })
})
