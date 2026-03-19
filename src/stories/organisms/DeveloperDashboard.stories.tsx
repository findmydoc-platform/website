import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'

import { DeveloperDashboardView } from '@/components/organisms/DeveloperDashboard'
import type { SeedRunSummary, SeedingCardMode } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import { SeedingCardView } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const makeRun = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => {
  const runId = `dashboard-${type}`
  const now = new Date().toISOString()

  return {
    runId,
    type,
    reset,
    queue: `seed:${runId}`,
    status: 'completed',
    createdAt: now,
    startedAt: now,
    completedAt: now,
    totalJobs: 2,
    completedJobs: 2,
    succeededJobs: 2,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobId: undefined,
    activeStepName: undefined,
    jobs: [
      {
        id: 'job-1',
        order: 1,
        status: 'succeeded',
        input: {} as SeedRunSummary['jobs'][number]['input'],
        queue: `seed:${runId}`,
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 1,
        chunkTotal: 2,
        createdAt: now,
        startedAt: now,
        completedAt: now,
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
      {
        id: 'job-2',
        order: 2,
        status: 'succeeded',
        input: {} as SeedRunSummary['jobs'][number]['input'],
        queue: `seed:${runId}`,
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 2,
        chunkTotal: 2,
        createdAt: now,
        startedAt: now,
        completedAt: now,
        created: 0,
        updated: 1,
        warnings: [],
        failures: [],
      },
    ],
    logs: [
      {
        id: 'log-1',
        at: now,
        severity: 'INFO',
        text: 'Started platformContentMedia',
        runId,
        jobId: 'job-1',
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        chunkIndex: 1,
        chunkTotal: 2,
      },
      {
        id: 'log-2',
        at: now,
        severity: 'INFO',
        text: 'Completed platformContentMedia: +1 / ~0',
        runId,
        jobId: 'job-1',
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        chunkIndex: 1,
        chunkTotal: 2,
      },
    ],
    warnings: [],
    failures: [],
    totals: { created: 1, updated: 1 },
    progress: { completed: 2, total: 2, percent: 100 },
    jobIds: ['job-1', 'job-2'],
    hasActiveJob: false,
  }
}

const toStoryLogs = (run: SeedRunSummary | null) => {
  if (!run) {
    return [{ id: 'empty', severity: 'INFO' as const, text: 'No seed run recorded yet.' }]
  }

  return [
    {
      id: 'summary',
      severity: 'INFO' as const,
      text: `Run ${run.type}${run.reset ? '+reset' : ''} completed with status ${run.status}`,
    },
    ...run.logs.map((log) => ({
      id: log.id,
      severity: log.severity,
      text: log.text,
    })),
  ]
}

type InteractiveSeedingSlotProps = {
  mode: SeedingCardMode
  baselineButtonLabel: string
  demoButtonLabel: string
  loading?: boolean
  error?: string | null
  run?: SeedRunSummary | null
}

const InteractiveSeedingSlot: React.FC<InteractiveSeedingSlotProps> = (props) => {
  const [run, setRun] = React.useState<SeedRunSummary | null>(props.run ?? null)

  const loading = props.loading ?? false
  const error = props.error ?? null

  const runSeed = (type: 'baseline' | 'demo', reset: boolean) => {
    setRun(makeRun(type, reset))
  }

  const onSeedBaseline = () => {
    runSeed('baseline', props.baselineButtonLabel.includes('Reset'))
  }

  const onSeedDemo = () => {
    runSeed('demo', props.demoButtonLabel.includes('Reset'))
  }

  return (
    <SeedingCardView
      mode={props.mode}
      userType="platform"
      isPlatformUser
      loading={loading}
      error={error}
      run={run}
      controls={{ maxLines: 500, showUnits: true, wrapLines: false }}
      logLines={toStoryLogs(run)}
      baselineButtonLabel={props.baselineButtonLabel}
      demoButtonLabel={props.demoButtonLabel}
      onSeedBaseline={onSeedBaseline}
      onSeedDemo={onSeedDemo}
      onRefreshStatus={() => undefined}
      onRetryUnfinishedJobs={() => undefined}
      onRetryJob={() => undefined}
      onCopyLogs={() => undefined}
      onExportLogFile={() => undefined}
      onExportJSONFile={() => undefined}
    />
  )
}

const meta = {
  title: 'Organisms/DeveloperDashboard',
  component: DeveloperDashboardView,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DeveloperDashboardView>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot mode="development" baselineButtonLabel="Seed Baseline" demoButtonLabel="Seed Demo" />
        }
      />
    )
  },
}

export const PlatformRerunShowsResetLabels: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            baselineButtonLabel="Reseed Baseline (Reset)"
            demoButtonLabel="Reseed Demo (Reset)"
          />
        }
      />
    )
  },
}

export const ProductionMode: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot mode="production" baselineButtonLabel="Seed Baseline" demoButtonLabel="Seed Demo" />
        }
      />
    )
  },
}

export const LoadingState: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            loading
            baselineButtonLabel="Seed Baseline"
            demoButtonLabel="Seed Demo"
          />
        }
      />
    )
  },
}

export const ErrorState: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            error="Simulated API error"
            baselineButtonLabel="Seed Baseline"
            demoButtonLabel="Seed Demo"
          />
        }
      />
    )
  },
}

export const WithCompletedBaselineRun: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            run={makeRun('baseline', false)}
            baselineButtonLabel="Reseed Baseline (Reset)"
            demoButtonLabel="Seed Demo"
          />
        }
      />
    )
  },
}

export const WithCompletedDemoReset: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            run={makeRun('demo', true)}
            baselineButtonLabel="Seed Baseline"
            demoButtonLabel="Reseed Demo (Reset)"
          />
        }
      />
    )
  },
}
