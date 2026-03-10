import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import type { SeedRunSummary } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import { SeedingCardView } from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import {
  formatSeedChangeSummary,
  formatSeedJobTitle,
  formatSeedRunTitle,
  formatSeedStepTitle,
} from '@/endpoints/seed/utils/labels'

const createSeedRunSummary = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => {
  const runId = `story-${type}`
  const now = new Date().toISOString()
  const runTitle = formatSeedRunTitle(type, reset)
  const primaryJobTitle = formatSeedJobTitle('platformContentMedia', 1, 2)
  const secondaryJobTitle = formatSeedJobTitle('platformContentMedia', 2, 2)

  return {
    runId,
    type,
    reset,
    queue: `seed:${runId}`,
    title: runTitle,
    status: 'running',
    createdAt: now,
    startedAt: now,
    completedAt: undefined,
    totalJobs: 2,
    completedJobs: 1,
    succeededJobs: 1,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobId: 'job-1',
    activeStepName: primaryJobTitle,
    jobs: [
      {
        id: 'job-1',
        order: 1,
        status: 'running',
        input: {} as SeedRunSummary['jobs'][number]['input'],
        queue: `seed:${runId}`,
        title: primaryJobTitle,
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 1,
        chunkTotal: 2,
        createdAt: now,
        startedAt: now,
        created: 1,
        updated: 0,
        warnings: [],
        failures: [],
      },
      {
        id: 'job-2',
        order: 2,
        status: 'queued',
        input: {} as SeedRunSummary['jobs'][number]['input'],
        queue: `seed:${runId}`,
        title: secondaryJobTitle,
        stepName: 'platformContentMedia',
        kind: 'collection',
        collection: 'platformContentMedia',
        fileName: 'platformContentMedia',
        chunkIndex: 2,
        chunkTotal: 2,
        createdAt: now,
        created: 0,
        updated: 0,
        warnings: [],
        failures: [],
      },
    ],
    logs: [
      {
        id: 'log-1',
        at: now,
        severity: 'INFO',
        text: `Started ${primaryJobTitle}`,
        runId,
        title: formatSeedStepTitle('platformContentMedia'),
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
        severity: 'WARN',
        text: 'Chunk is large but still within limits',
        runId,
        title: formatSeedStepTitle('platformContentMedia'),
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
    totals: { created: 1, updated: 0 },
    progress: { completed: 1, total: 2, percent: 50 },
    jobIds: ['job-1', 'job-2'],
    hasActiveJob: true,
  }
}

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
    run: null,
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
    onRetryUnfinishedJobs: () => undefined,
    onRetryJob: () => undefined,
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

export const RunningWithJobs: Story = {
  args: {
    run: createSeedRunSummary('baseline', false),
    logLines: [
      { id: 'summary', severity: 'INFO', text: `Started ${formatSeedJobTitle('platformContentMedia', 1, 2)}` },
      { id: 'chunk', severity: 'WARN', text: 'Chunk is large but still within limits' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('progressbar', { name: 'Seed progress' })).toHaveAttribute('aria-valuenow', '50')
    expect(canvas.getByText(/1\/2 jobs · 50%/)).toBeInTheDocument()
    expect(canvas.getByText(/Jobs \(2\)/)).toBeInTheDocument()
    expect(canvas.getByText(/^Status running$/)).toBeInTheDocument()
    expect(canvas.getByText('Role:')).toBeInTheDocument()
    expect(canvas.getByText('Seed:')).toBeInTheDocument()
    expect(canvas.getByText('Baseline seed')).toBeInTheDocument()
    expect(canvas.getByText('Running')).toBeInTheDocument()
    expect(canvas.getByText('Current step:')).toBeInTheDocument()
    expect(canvas.getByText(formatSeedStepTitle('platformContentMedia (1/2)'))).toBeInTheDocument()
    expect(canvas.getByText(formatSeedChangeSummary(1, 0))).toBeInTheDocument()
  },
}

export const CollapsedQueue: Story = {
  args: {
    run: createSeedRunSummary('baseline', false),
    logLines: [
      { id: 'summary', severity: 'INFO', text: `Started ${formatSeedJobTitle('platformContentMedia', 1, 2)}` },
      { id: 'chunk', severity: 'WARN', text: 'Chunk is large but still within limits' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Collapse queue' }))
    expect(canvas.getByRole('button', { name: 'Expand queue' })).toBeInTheDocument()
    expect(canvas.queryByText(/Jobs \(2\)/)).not.toBeInTheDocument()
    expect(canvas.queryByText('Current step:')).not.toBeInTheDocument()
    expect(canvas.queryByText(formatSeedStepTitle('platformContentMedia (1/2)'))).not.toBeInTheDocument()
    expect(canvas.getByRole('progressbar', { name: 'Seed progress' })).toHaveAttribute('aria-valuenow', '50')
  },
}

const partialFailureBase = createSeedRunSummary('baseline', false)

const failedSeedRun: SeedRunSummary = {
  ...partialFailureBase,
  status: 'partial' as const,
  completedJobs: 2,
  succeededJobs: 1,
  failedJobs: 1,
  cancelledJobs: 0,
  activeJobId: undefined,
  activeStepName: undefined,
  jobs: [
    {
      ...partialFailureBase.jobs[0]!,
      status: 'succeeded' as const,
      completedAt: new Date().toISOString(),
      created: 1,
      updated: 0,
    },
    {
      ...partialFailureBase.jobs[1]!,
      status: 'failed' as const,
      completedAt: new Date().toISOString(),
      created: 0,
      updated: 2,
      failures: ['Storage upload failed after retry.'],
      error: 'Storage upload failed after retry.',
    },
  ],
  progress: { completed: 2, total: 2, percent: 100 },
  hasActiveJob: false,
}

export const PartialFailure: Story = {
  args: {
    run: failedSeedRun,
    logLines: [
      { id: 'summary', severity: 'ERROR', text: 'Seed finished with one failed job.' },
      {
        id: 'success',
        severity: 'INFO',
        text: `${formatSeedStepTitle('platformContentMedia')} imported successfully.`,
      },
      {
        id: 'failure',
        severity: 'ERROR',
        text: `${formatSeedStepTitle('platformContentMedia')} failed on retry.`,
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText('Role:')).toBeInTheDocument()
    expect(canvas.getByText('Seed:')).toBeInTheDocument()
    expect(canvas.getByText('Baseline seed')).toBeInTheDocument()
    expect(canvas.getByText('partial')).toBeInTheDocument()
    expect(canvas.getByText(formatSeedChangeSummary(1, 0))).toBeInTheDocument()
    expect(canvas.getByText(formatSeedChangeSummary(0, 2))).toBeInTheDocument()
    expect(canvas.getByText(/^succeeded$/)).toBeInTheDocument()
    expect(canvas.getByText(/^failed$/)).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Retry unfinished jobs' })).toBeInTheDocument()
    expect(
      canvas.getByRole('button', { name: `Retry ${formatSeedJobTitle('platformContentMedia', 2, 2)}` }),
    ).toBeInTheDocument()
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
  },
}

export const ErrorState: Story = {
  args: { error: 'Simulated API Error' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Error: Simulated API Error/)).toBeInTheDocument()
  },
}

const completedBaselineRun = createSeedRunSummary('baseline', false)

export const WithCompletedRun: Story = {
  args: {
    run: {
      ...completedBaselineRun,
      status: 'completed',
      completedAt: new Date().toISOString(),
      completedJobs: 2,
      succeededJobs: 2,
      failedJobs: 0,
      cancelledJobs: 0,
      activeJobId: undefined,
      activeStepName: undefined,
      jobs: completedBaselineRun.jobs.map((job, index) => ({
        ...job,
        status: 'succeeded',
        startedAt: job.startedAt ?? new Date().toISOString(),
        completedAt: job.completedAt ?? new Date().toISOString(),
        created: index === 0 ? 1 : 0,
        updated: index === 0 ? 0 : 1,
      })),
      progress: { completed: 2, total: 2, percent: 100 },
      hasActiveJob: false,
    },
    logLines: [
      { id: 'summary', severity: 'INFO', text: 'Run completed successfully.' },
      { id: 'unit-1', severity: 'INFO', text: 'job 1 finished successfully.' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/Status completed/)).toBeInTheDocument()
    expect(canvas.getByText('Completed at:')).toBeInTheDocument()
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
