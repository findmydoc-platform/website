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

type DashboardWidgetConfig = {
  slug: 'developer-seeding'
  label: string
  ComponentPath: '@/components/organisms/DeveloperDashboard'
  minWidth: 'medium'
  maxWidth: 'full'
  fields: SeedingWidgetField[]
}

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
  ComponentPath: '@/components/organisms/DeveloperDashboard',
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
        description: 'Include seed unit summary lines in the log console.',
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

const isDeveloperDashboardEnabled = (env: NodeJS.ProcessEnv): boolean => env.FEATURE_DEVELOPER_DASHBOARD === 'true'

export const createAdminDashboardConfig = (env: NodeJS.ProcessEnv = process.env): PayloadDashboardConfig => {
  if (!isDeveloperDashboardEnabled(env)) {
    return {
      widgets: [],
      defaultLayout: [DEFAULT_COLLECTIONS_LAYOUT],
    }
  }

  return {
    widgets: [DEVELOPER_SEEDING_WIDGET],
    defaultLayout: [DEFAULT_COLLECTIONS_LAYOUT, { widgetSlug: 'developer-seeding', width: 'full' }],
  }
}
