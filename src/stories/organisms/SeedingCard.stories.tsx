import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'

import type { SeedRunSummary } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import { SeedingCardView } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const createSeedRunSummary = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => ({
  type,
  reset,
  status: 'ok',
  baselineFailed: false,
  startedAt: new Date().toISOString(),
  finishedAt: new Date().toISOString(),
  durationMs: 2000,
  totals: { created: 3, updated: 1 },
  units: [
    { name: 'Clinics', created: 1, updated: 1 },
    { name: 'Treatments', created: 2, updated: 0 },
  ],
})

const meta: Meta<typeof SeedingCardView> = {
  title: 'Organisms/SeedingCard',
  component: SeedingCardView,
  tags: ['autodocs'],
  args: {
    mode: 'development',
    userType: 'platform',
    loading: false,
    error: null,
    lastRun: null,
    baselineButtonLabel: 'Seed Baseline',
    demoButtonLabel: 'Seed Demo',
    onSeedBaseline: () => undefined,
    onSeedDemo: () => undefined,
    onRefreshStatus: () => undefined,
    confirmBaselineResetOpen: false,
    onConfirmBaselineResetOpenChange: () => undefined,
    onConfirmBaselineReset: () => undefined,
    confirmDemoResetOpen: false,
    onConfirmDemoResetOpenChange: () => undefined,
    onConfirmDemoReset: () => undefined,
  },
}

export default meta

type Story = StoryObj<typeof SeedingCardView>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    const seedBaseline = canvas.getByRole('button', { name: 'Seed Baseline' })
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo' })
    const refreshStatus = canvas.getByRole('button', { name: 'Refresh Status' })

    expect(seedBaseline).toBeEnabled()
    expect(seedDemo).toBeEnabled()
    expect(refreshStatus).toBeEnabled()
  },
}

export const ProductionMode: Story = {
  args: { mode: 'production' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo' })
    expect(seedDemo).toBeDisabled()
    expect(seedDemo).toHaveAttribute('title', 'Disabled in production')
  },
}

export const LoadingState: Story = {
  args: { loading: true },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('button', { name: 'Seed Baseline' })).toBeDisabled()
    expect(canvas.getByRole('button', { name: 'Seed Demo' })).toBeDisabled()
    expect(canvas.getByRole('button', { name: 'Refresh Status' })).toBeDisabled()
  },
}

export const ErrorState: Story = {
  args: { error: 'Simulated API Error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Error: Simulated API Error/)).toBeInTheDocument()
  },
}

export const SuccessWithResults: Story = {
  args: { lastRun: createSeedRunSummary('baseline', false) },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Last Run:/)).toBeInTheDocument()
    expect(canvas.getByText(/Totals: created 3, updated 1/)).toBeInTheDocument()
    expect(canvas.getByText(/Clinics: \+1 \/ ~1/)).toBeInTheDocument()
  },
}
