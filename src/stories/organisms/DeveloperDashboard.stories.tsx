import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'

import { DeveloperDashboardView } from '@/components/organisms/DeveloperDashboard'

import type { SeedRunSummary, SeedingCardMode } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import { SeedingCardView } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const makeLastRun = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => ({
  type,
  reset,
  status: 'ok',
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 2000,
  totals: { created: 3, updated: 1 },
  warnings: [],
  failures: [],
  units: [
    { name: 'Clinics', created: 1, updated: 1 },
    { name: 'Treatments', created: 2, updated: 0 },
  ],
})

type InteractiveSeedingSlotProps = {
  mode: SeedingCardMode
  baselineButtonLabel: string
  demoButtonLabel: string
  loading?: boolean
  error?: string | null
  lastRun?: SeedRunSummary | null
}

const InteractiveSeedingSlot: React.FC<InteractiveSeedingSlotProps> = (props) => {
  const [lastRun, setLastRun] = React.useState<SeedRunSummary | null>(props.lastRun ?? null)

  const loading = props.loading ?? false
  const error = props.error ?? null

  const runSeed = (type: 'baseline' | 'demo', reset: boolean) => {
    setLastRun(makeLastRun(type, reset))
  }

  const onSeedBaseline = () => {
    if (props.baselineButtonLabel.includes('Reset')) {
      runSeed('baseline', true)
      return
    }
    runSeed('baseline', false)
  }

  const onSeedDemo = () => {
    if (props.demoButtonLabel.includes('Reset')) {
      runSeed('demo', true)
      return
    }
    runSeed('demo', false)
  }

  return (
    <SeedingCardView
      mode={props.mode}
      userType="platform"
      loading={loading}
      error={error}
      lastRun={lastRun}
      baselineButtonLabel={props.baselineButtonLabel}
      demoButtonLabel={props.demoButtonLabel}
      onSeedBaseline={onSeedBaseline}
      onSeedDemo={onSeedDemo}
      onRefreshStatus={() => undefined}
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

export const WithLastRunBaseline: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            lastRun={makeLastRun('baseline', false)}
            baselineButtonLabel="Reseed Baseline (Reset)"
            demoButtonLabel="Seed Demo"
          />
        }
      />
    )
  },
}

export const WithLastRunDemoReset: Story = {
  render: () => {
    return (
      <DeveloperDashboardView
        seedingSlot={
          <InteractiveSeedingSlot
            mode="development"
            lastRun={makeLastRun('demo', true)}
            baselineButtonLabel="Seed Baseline"
            demoButtonLabel="Reseed Demo (Reset)"
          />
        }
      />
    )
  },
}
