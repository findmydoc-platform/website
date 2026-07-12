type DashboardWidgetLayout = {
  widgetSlug: string
  width: 'full' | 'medium'
}

type SeedingWidgetField = {
  name: 'maxLines' | 'showUnits' | 'wrapLines'
  type: 'number' | 'checkbox'
  label: string
  defaultValue: number | boolean
  min?: number
  max?: number
  admin?: {
    step?: number
    description: string
  }
}

type DeveloperSeedingWidgetConfig = {
  slug: 'developer-seeding'
  label: string
  Component: '@/components/organisms/DeveloperDashboard'
  minWidth: 'medium'
  maxWidth: 'full'
  fields: SeedingWidgetField[]
}

type CacheRevalidationVisibilityWidgetConfig = {
  slug: 'cache-revalidation-visibility'
  label: string
  Component: '@/components/organisms/CacheRevalidationVisibility'
  minWidth: 'medium'
  maxWidth: 'full'
  fields: []
}

type DashboardWidgetConfig = DeveloperSeedingWidgetConfig | CacheRevalidationVisibilityWidgetConfig

type PayloadDashboardConfig = {
  widgets: DashboardWidgetConfig[]
  defaultLayout: DashboardWidgetLayout[]
}

const DEFAULT_COLLECTIONS_LAYOUT: DashboardWidgetLayout = {
  widgetSlug: 'collections',
  width: 'full',
}

const DEVELOPER_SEEDING_WIDGET: DashboardWidgetConfig = {
  slug: 'developer-seeding',
  label: 'Developer seeding',
  Component: '@/components/organisms/DeveloperDashboard',
  minWidth: 'medium',
  maxWidth: 'full',
  fields: [
    {
      name: 'maxLines',
      type: 'number',
      label: 'Max log lines',
      min: 50,
      max: 5000,
      defaultValue: 500,
      admin: {
        step: 50,
        description: 'Maximum number of log lines visible in the widget console.',
      },
    },
    {
      name: 'showUnits',
      type: 'checkbox',
      label: 'Show units',
      defaultValue: true,
      admin: {
        description: 'Show per-job summary cards above the log console.',
      },
    },
    {
      name: 'wrapLines',
      type: 'checkbox',
      label: 'Wrap lines',
      defaultValue: false,
      admin: {
        description: 'Wrap long log lines inside the console instead of horizontal scrolling.',
      },
    },
  ],
}

const CACHE_REVALIDATION_VISIBILITY_WIDGET: DashboardWidgetConfig = {
  slug: 'cache-revalidation-visibility',
  label: 'Cache revalidation visibility',
  Component: '@/components/organisms/CacheRevalidationVisibility',
  minWidth: 'medium',
  maxWidth: 'full',
  fields: [],
}

export const createAdminDashboardConfig = (_env: NodeJS.ProcessEnv = process.env): PayloadDashboardConfig => {
  // Keep widget definitions stable across environments so generated payload-types
  // always include the developer seeding and cache visibility widget contracts.
  return {
    widgets: [DEVELOPER_SEEDING_WIDGET, CACHE_REVALIDATION_VISIBILITY_WIDGET],
    defaultLayout: [
      DEFAULT_COLLECTIONS_LAYOUT,
      { widgetSlug: 'developer-seeding', width: 'full' },
      { widgetSlug: 'cache-revalidation-visibility', width: 'full' },
    ],
  }
}
