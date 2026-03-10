import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import type { SeedRunSummary } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import { SeedingCardView } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'

const createSeedRunSummary = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => ({
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

const meta: Meta<typeof SeedingCardView> = {
  title: 'Domain/Platform/Organisms/SeedingCard',
  component: SeedingCardView,
  tags: ['autodocs', 'domain:platform', 'layer:organism', 'status:stable', 'used-in:block:seeding-card'],
  args: {
    mode: 'development',
    userType: 'platform',
    isPlatformUser: true,
    loading: false,
    error: null,
    lastRun: null,
    controls: { maxLines: 500, showUnits: true, wrapLines: false },
    logLines: [
      { id: '1', severity: 'INFO', text: 'No seed run recorded yet.' },
      { id: '2', severity: 'WARN', text: 'Sample warning line' },
      { id: '3', severity: 'ERROR', text: 'Sample error line' },
    ],
    baselineButtonLabel: 'Seed Baseline',
    demoButtonLabel: 'Seed Demo',
    onSeedBaseline: () => undefined,
    onSeedDemo: () => undefined,
    onRefreshStatus: () => undefined,
    onCopyLogs: () => undefined,
    onExportLogFile: () => undefined,
    onExportJSONFile: () => undefined,
  },
}

export default meta

type Story = StoryObj<typeof SeedingCardView>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    expect(canvas.getByRole('button', { name: 'Seed Baseline' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Seed Demo' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Refresh Status' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Copy logs' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Export .log' })).toBeEnabled()
    expect(canvas.getByRole('button', { name: 'Export .json' })).toBeEnabled()
    expect(canvas.queryByRole('button', { name: 'Copy Logs' })).not.toBeInTheDocument()
    expect(canvas.getByText('[INFO]')).toBeInTheDocument()
    expect(canvas.getByText('[WARN]')).toBeInTheDocument()
    expect(canvas.getByText('[ERROR]')).toBeInTheDocument()
    expect(canvas.getByTestId('seeding-log-viewport')).toHaveStyle({ height: '320px' })
  },
}

export const ProductionMode: Story = {
  args: { mode: 'production' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const seedDemo = canvas.getByRole('button', { name: 'Seed Demo' })
    expect(seedDemo).toBeDisabled()
    expect(canvas.getByText(/production mode: demo disabled/)).toBeInTheDocument()
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
  args: {
    lastRun: createSeedRunSummary('baseline', false),
    logLines: [
      { id: 'summary', severity: 'INFO', text: 'Run completed successfully.' },
      { id: 'unit-1', severity: 'INFO', text: 'unit Clinics: +1 / ~1' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Run completed successfully/)).toBeInTheDocument()
    expect(canvas.getByText(/unit Clinics/)).toBeInTheDocument()
  },
}

export const NonPlatformHintOnly: Story = {
  args: {
    userType: 'clinic',
    isPlatformUser: false,
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/available to platform basic users only/i)).toBeInTheDocument()
    expect(canvas.queryByRole('button', { name: 'Seed Baseline' })).not.toBeInTheDocument()
  },
}
