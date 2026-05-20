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

const STORY_TIMESTAMP = '2026-05-17T10:00:00.000Z'
const STORY_COMPLETED_TIMESTAMP = '2026-05-17T10:04:00.000Z'

const createSeedRunSummary = (type: 'baseline' | 'demo', reset: boolean): SeedRunSummary => {
  const runId = `story-${type}`
  const now = STORY_TIMESTAMP
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

const createDenseChunkedSeedRunSummary = (): SeedRunSummary => {
  const runId = 'story-dense-chunks'
  const now = STORY_TIMESTAMP
  const chunkedJobs = [1, 2, 3, 4, 5, 6].map((chunkIndex) => ({
    id: `cities-${chunkIndex}`,
    order: chunkIndex,
    status: chunkIndex < 4 ? ('succeeded' as const) : chunkIndex === 4 ? ('running' as const) : ('queued' as const),
    input: {} as SeedRunSummary['jobs'][number]['input'],
    queue: `seed:${runId}`,
    title: formatSeedJobTitle('cities', chunkIndex, 6),
    stepName: 'cities',
    kind: 'collection' as const,
    collection: 'cities',
    fileName: 'cities',
    chunkIndex,
    chunkTotal: 6,
    createdAt: now,
    startedAt: chunkIndex <= 4 ? now : undefined,
    completedAt: chunkIndex < 4 ? now : undefined,
    created: chunkIndex < 4 ? 2 : 0,
    updated: chunkIndex < 4 ? 1 : 0,
    warnings: chunkIndex === 2 ? ['Minor warning'] : [],
    failures: [],
  }))
  const singleJobs: SeedRunSummary['jobs'] = [
    {
      id: 'settings',
      order: 7,
      status: 'queued',
      input: {} as SeedRunSummary['jobs'][number]['input'],
      queue: `seed:${runId}`,
      title: formatSeedJobTitle('globals'),
      stepName: 'globals',
      kind: 'globals',
      fileName: 'globals',
      createdAt: now,
      created: 0,
      updated: 0,
      warnings: [],
      failures: [],
    },
    {
      id: 'treatments',
      order: 8,
      status: 'queued',
      input: {} as SeedRunSummary['jobs'][number]['input'],
      queue: `seed:${runId}`,
      title: formatSeedJobTitle('treatments'),
      stepName: 'treatments',
      kind: 'collection',
      collection: 'treatments',
      fileName: 'treatments',
      chunkIndex: 1,
      chunkTotal: 1,
      createdAt: now,
      created: 0,
      updated: 0,
      warnings: [],
      failures: [],
    },
  ]
  const jobs = [...chunkedJobs, ...singleJobs]

  return {
    runId,
    type: 'baseline',
    reset: false,
    queue: `seed:${runId}`,
    title: formatSeedRunTitle('baseline', false),
    status: 'running',
    createdAt: now,
    startedAt: now,
    completedAt: undefined,
    totalJobs: jobs.length,
    completedJobs: 3,
    succeededJobs: 3,
    failedJobs: 0,
    cancelledJobs: 0,
    activeJobId: 'cities-4',
    activeStepName: formatSeedJobTitle('cities', 4, 6),
    jobs,
    logs: [{ id: 'summary', at: now, severity: 'INFO', text: `Started ${formatSeedJobTitle('cities', 4, 6)}`, runId }],
    warnings: [],
    failures: [],
    totals: { created: 6, updated: 3 },
    progress: { completed: 3, total: jobs.length, percent: 38 },
    jobIds: jobs.map((job) => job.id),
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
    expect(canvas.getByText(/Seed units \(1\) · 2 jobs/)).toBeInTheDocument()
    expect(canvas.getByText(/^Status running$/)).toBeInTheDocument()
    expect(canvas.getByText('Role:')).toBeInTheDocument()
    expect(canvas.getByText('Seed:')).toBeInTheDocument()
    expect(canvas.getByText('Baseline seed')).toBeInTheDocument()
    expect(canvas.getByText('Running')).toBeInTheDocument()
    expect(canvas.getByText('Current step:')).toBeInTheDocument()
    expect(canvas.getByText(formatSeedStepTitle('platformContentMedia (1/2)'))).toBeInTheDocument()
    expect(canvas.getByText(`1. ${formatSeedStepTitle('platformContentMedia')}`)).toBeInTheDocument()
    expect(canvas.getByText('Batch 1/2')).toBeInTheDocument()
    expect(canvas.getByText(formatSeedChangeSummary(1, 0))).toBeInTheDocument()
  },
}

export const DenseChunkedQueue: Story = {
  args: {
    run: createDenseChunkedSeedRunSummary(),
    logLines: [{ id: 'summary', severity: 'INFO', text: `Started ${formatSeedJobTitle('cities', 4, 6)}` }],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByText(/3\/8 jobs · 38%/)).toBeInTheDocument()
    expect(canvas.getByText(/Seed units \(3\) · 8 jobs/)).toBeInTheDocument()
    expect(canvas.getByText(`1. ${formatSeedStepTitle('cities')}`)).toBeInTheDocument()
    expect(canvas.getByText('Batch 4/6')).toBeInTheDocument()
    expect(canvas.getByText(formatSeedChangeSummary(6, 3))).toBeInTheDocument()
    expect(canvas.getByText('Batch 2/6: 1 warning(s)')).toBeInTheDocument()
    expect(canvas.getByText(`7. ${formatSeedStepTitle('globals')}`)).toBeInTheDocument()
    expect(canvas.getByText(`8. ${formatSeedStepTitle('treatments')}`)).toBeInTheDocument()
    expect(canvas.queryByText(`2. ${formatSeedJobTitle('cities', 2, 6)}`)).not.toBeInTheDocument()
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
    expect(canvas.queryByText(/Seed units \(1\) · 2 jobs/)).not.toBeInTheDocument()
    expect(canvas.queryByText('Current step:')).not.toBeInTheDocument()
    expect(canvas.queryByText(formatSeedStepTitle('platformContentMedia (1/2)'))).not.toBeInTheDocument()
    expect(canvas.getByRole('progressbar', { name: 'Seed progress' })).toHaveAttribute('aria-valuenow', '50')
  },
}

const partialFailureBase = createSeedRunSummary('baseline', false)

const failedSeedRun: SeedRunSummary = {
  ...partialFailureBase,
  status: 'partial' as const,
  totalJobs: 3,
  completedJobs: 3,
  succeededJobs: 1,
  failedJobs: 1,
  cancelledJobs: 1,
  activeJobId: undefined,
  activeStepName: undefined,
  jobs: [
    {
      ...partialFailureBase.jobs[0]!,
      status: 'succeeded' as const,
      completedAt: STORY_COMPLETED_TIMESTAMP,
      created: 1,
      updated: 0,
      chunkTotal: 3,
    },
    {
      ...partialFailureBase.jobs[1]!,
      status: 'failed' as const,
      title: formatSeedJobTitle('platformContentMedia', 2, 3),
      chunkTotal: 3,
      completedAt: STORY_COMPLETED_TIMESTAMP,
      created: 0,
      updated: 2,
      failures: ['Storage upload failed after retry.'],
      error: 'Storage upload failed after retry.',
    },
    {
      ...partialFailureBase.jobs[1]!,
      id: 'job-3',
      order: 3,
      status: 'cancelled' as const,
      title: formatSeedJobTitle('platformContentMedia', 3, 3),
      chunkIndex: 3,
      chunkTotal: 3,
      completedAt: STORY_COMPLETED_TIMESTAMP,
      created: 0,
      updated: 0,
      failures: [],
      error: undefined,
    },
  ],
  progress: { completed: 3, total: 3, percent: 100 },
  jobIds: ['job-1', 'job-2', 'job-3'],
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
    expect(canvas.getByText(formatSeedChangeSummary(1, 2))).toBeInTheDocument()
    expect(canvas.getByText(/^failed$/)).toBeInTheDocument()
    expect(canvas.getByText('Batch 2/3: failed, 1 failure(s) · Batch 3/3: cancelled')).toBeInTheDocument()
    expect(canvas.getByText('Retry 2/3')).toBeInTheDocument()
    expect(canvas.getByText('Retry 3/3')).toBeInTheDocument()
    expect(canvas.getByRole('button', { name: 'Retry unfinished jobs' })).toBeInTheDocument()
    expect(
      canvas.getByRole('button', { name: `Retry ${formatSeedJobTitle('platformContentMedia', 2, 3)}` }),
    ).toBeInTheDocument()
    expect(
      canvas.getByRole('button', { name: `Retry ${formatSeedJobTitle('platformContentMedia', 3, 3)}` }),
    ).toBeInTheDocument()
  },
}

export const ProductionMode: Story = {
  args: { mode: 'production' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    expect(canvas.getByRole('button', { name: 'Seed Baseline' })).toBeInTheDocument()
    expect(canvas.queryByRole('button', { name: 'Seed Demo' })).not.toBeInTheDocument()
    expect(canvas.queryByText(/production mode: demo disabled/i)).not.toBeInTheDocument()
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
      completedAt: STORY_COMPLETED_TIMESTAMP,
      completedJobs: 2,
      succeededJobs: 2,
      failedJobs: 0,
      cancelledJobs: 0,
      activeJobId: undefined,
      activeStepName: undefined,
      jobs: completedBaselineRun.jobs.map((job, index) => ({
        ...job,
        status: 'succeeded',
        startedAt: job.startedAt ?? STORY_TIMESTAMP,
        completedAt: job.completedAt ?? STORY_COMPLETED_TIMESTAMP,
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
