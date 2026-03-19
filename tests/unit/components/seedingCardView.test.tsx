// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

type MockPayloadButtonProps = React.ComponentPropsWithoutRef<'button'> & {
  icon?: React.ReactNode
  tooltip?: string
}

vi.mock('@payloadcms/ui/elements/Button', () => ({
  Button: ({
    children,
    icon,
    tooltip,
    buttonStyle: _buttonStyle,
    iconStyle: _iconStyle,
    margin: _margin,
    size: _size,
    ...buttonProps
  }: MockPayloadButtonProps & {
    buttonStyle?: string
    iconStyle?: string
    margin?: boolean
    size?: string
  }) => (
    <button title={tooltip} {...buttonProps}>
      {icon}
      {children}
    </button>
  ),
}))
import {
  SeedingCardView,
  getDemoSeedPolicy,
  modeFromNodeEnv,
  modeFromRuntimeEnv,
  normalizeSeedingWidgetControls,
  type SeedRunSummary,
} from '@/components/organisms/DeveloperDashboard/Seeding/SeedingCardView'
import {
  formatSeedChangeSummary,
  formatSeedJobTitle,
  formatSeedRunTitle,
  formatSeedStepTitle,
} from '@/endpoints/seed/utils/labels'

const baseControls = { maxLines: 500, showUnits: true, wrapLines: false }

const createRun = (overrides: Partial<SeedRunSummary> = {}): SeedRunSummary => {
  const runId = overrides.runId ?? 'run-1'
  const runType = overrides.type ?? 'baseline'
  const runReset = overrides.reset ?? false
  const runTitle = overrides.title ?? formatSeedRunTitle(runType, runReset)
  const primaryJobTitle = formatSeedJobTitle('platformContentMedia', 1, 2)
  const secondaryJobTitle = formatSeedJobTitle('platformContentMedia', 2, 2)
  const jobs = overrides.jobs ?? [
    {
      id: 'job-1',
      order: 1,
      status: 'running',
      input: {} as SeedRunSummary['jobs'][number]['input'],
      queue: `seed:${runId}`,
      title: primaryJobTitle,
      stepName: 'platformContentMedia',
      kind: 'collection' as const,
      collection: 'platformContentMedia',
      fileName: 'platformContentMedia',
      chunkIndex: 1,
      chunkTotal: 2,
      createdAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
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
      kind: 'collection' as const,
      collection: 'platformContentMedia',
      fileName: 'platformContentMedia',
      chunkIndex: 2,
      chunkTotal: 2,
      createdAt: new Date().toISOString(),
      created: 0,
      updated: 0,
      warnings: [],
      failures: [],
    },
  ]

  return {
    runId,
    type: runType,
    reset: runReset,
    queue: overrides.queue ?? `seed:${runId}`,
    title: runTitle,
    status: overrides.status ?? 'running',
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    startedAt: overrides.startedAt ?? new Date().toISOString(),
    completedAt: overrides.completedAt,
    totalJobs: overrides.totalJobs ?? jobs.length,
    completedJobs: overrides.completedJobs ?? 1,
    succeededJobs: overrides.succeededJobs ?? 1,
    failedJobs: overrides.failedJobs ?? 0,
    cancelledJobs: overrides.cancelledJobs ?? 0,
    activeJobId: overrides.activeJobId ?? 'job-1',
    activeStepName: overrides.activeStepName ?? primaryJobTitle,
    jobs: jobs as SeedRunSummary['jobs'],
    logs: overrides.logs ?? [
      {
        id: 'log-1',
        at: new Date().toISOString(),
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
    ],
    warnings: overrides.warnings ?? [],
    failures: overrides.failures ?? [],
    totals: overrides.totals ?? { created: 1, updated: 0 },
    progress: overrides.progress ?? {
      completed: 1,
      total: jobs.length,
      percent: 50,
    },
    jobIds: overrides.jobIds ?? jobs.map((job) => job.id),
    hasActiveJob: overrides.hasActiveJob ?? true,
  }
}

const baseProps = {
  mode: 'development' as const,
  userType: 'platform' as const,
  isPlatformUser: true,
  loading: false,
  error: null,
  run: null,
  controls: baseControls,
  logLines: [{ id: '1', severity: 'INFO' as const, text: 'No seed run recorded yet.' }],
  baselineButtonLabel: 'Seed Baseline',
  demoButtonLabel: 'Seed Demo',
  onSeedBaseline: () => undefined,
  onSeedDemo: () => undefined,
  onRetryUnfinishedJobs: () => undefined,
  onRetryJob: () => undefined,
  onCopyLogs: () => undefined,
  onExportLogFile: () => undefined,
  onExportJSONFile: () => undefined,
}

describe('SeedingCardView', () => {
  it('enables demo seed for platform in development', () => {
    render(<SeedingCardView {...baseProps} />)

    expect(screen.getByText('Seed Demo')).toBeInTheDocument()
    expect(screen.getByText(/Logs \(1\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy logs' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export .log' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Export .json' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Copy Logs' })).not.toBeInTheDocument()
    expect(screen.queryByText(/available to platform basic users only/)).not.toBeInTheDocument()
  })

  it('shows hint-only card for non-platform users', () => {
    render(<SeedingCardView {...baseProps} userType="clinic" isPlatformUser={false} />)

    expect(screen.getByText(/available to platform basic users only/i)).toBeInTheDocument()
    expect(screen.queryByText('Seed Baseline')).not.toBeInTheDocument()
    expect(screen.queryByText('Seed Demo')).not.toBeInTheDocument()
  })

  it('disables demo seed in production', () => {
    render(<SeedingCardView {...baseProps} mode="production" />)

    expect(screen.getByRole('button', { name: 'Seed Demo' })).toBeDisabled()
    expect(screen.getByText(/production mode: demo disabled/)).toBeInTheDocument()
  })

  it('renders error text when provided', () => {
    render(<SeedingCardView {...baseProps} error="Simulated error" />)

    expect(screen.getByText('Error: Simulated error')).toBeInTheDocument()
  })

  it('renders provided log lines with severity labels', () => {
    render(
      <SeedingCardView
        {...baseProps}
        logLines={[
          { id: 'a', severity: 'INFO', text: 'Started' },
          { id: 'b', severity: 'WARN', text: 'Warning example' },
          { id: 'c', severity: 'ERROR', text: 'Error example' },
        ]}
      />,
    )

    expect(screen.getByText('[INFO]')).toBeInTheDocument()
    expect(screen.getByText('[WARN]')).toBeInTheDocument()
    expect(screen.getByText('[ERROR]')).toBeInTheDocument()
    expect(screen.getByText('Warning example')).toBeInTheDocument()
    expect(screen.getByText('Error example')).toBeInTheDocument()
  })

  it('shows run progress, status and job cards', () => {
    const run = createRun({
      status: 'running',
      progress: { completed: 1, total: 2, percent: 50 },
      activeStepName: 'platformContentMedia (1/2)',
      jobs: undefined,
    })

    render(
      <SeedingCardView
        {...baseProps}
        run={run}
        logLines={[
          { id: 'run-log', severity: 'INFO', text: `Started ${formatSeedJobTitle('platformContentMedia', 1, 2)}` },
          { id: 'run-log-2', severity: 'WARN', text: 'Chunk is large' },
        ]}
      />,
    )

    expect(screen.getByText('Role:')).toBeInTheDocument()
    expect(screen.getByText('Seed:')).toBeInTheDocument()
    expect(screen.getByText('Baseline seed')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText(/1\/2 jobs · 50%/)).toBeInTheDocument()
    expect(screen.getByText(/^Status running$/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse queue' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
    expect(screen.getByText(/Jobs \(2\)/)).toBeInTheDocument()
    expect(screen.getByText('Current step:')).toBeInTheDocument()
    expect(screen.getByText(formatSeedStepTitle('platformContentMedia (1/2)'))).toBeInTheDocument()
    expect(screen.getByText(`1. ${formatSeedStepTitle('platformContentMedia (1/2)')}`)).toBeInTheDocument()
    expect(screen.getByText(`2. ${formatSeedStepTitle('platformContentMedia (2/2)')}`)).toBeInTheDocument()
    expect(screen.getByText(formatSeedChangeSummary(1, 0))).toBeInTheDocument()
    expect(screen.getByText(/^running$/)).toBeInTheDocument()
    expect(screen.getByText(/^queued$/)).toBeInTheDocument()
  })

  it('shows retry actions for failed and cancelled jobs', () => {
    const onRetryUnfinishedJobs = vi.fn()
    const onRetryJob = vi.fn()
    const run = createRun({
      status: 'partial',
      progress: { completed: 2, total: 2, percent: 100 },
      completedJobs: 2,
      succeededJobs: 1,
      failedJobs: 1,
      cancelledJobs: 0,
      activeJobId: undefined,
      activeStepName: undefined,
      hasActiveJob: false,
      jobs: [
        {
          id: 'job-1',
          order: 1,
          status: 'succeeded',
          input: {} as SeedRunSummary['jobs'][number]['input'],
          queue: 'seed:run-1',
          title: formatSeedJobTitle('platformContentMedia', 1, 2),
          stepName: 'platformContentMedia',
          kind: 'collection' as const,
          collection: 'platformContentMedia',
          fileName: 'platformContentMedia',
          chunkIndex: 1,
          chunkTotal: 2,
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          created: 1,
          updated: 0,
          warnings: [],
          failures: [],
        },
        {
          id: 'job-2',
          order: 2,
          status: 'failed',
          input: {} as SeedRunSummary['jobs'][number]['input'],
          queue: 'seed:run-1',
          title: formatSeedJobTitle('platformContentMedia', 2, 2),
          stepName: 'platformContentMedia',
          kind: 'collection' as const,
          collection: 'platformContentMedia',
          fileName: 'platformContentMedia',
          chunkIndex: 2,
          chunkTotal: 2,
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          created: 0,
          updated: 2,
          warnings: [],
          failures: ['Storage upload failed after retry.'],
          error: 'Storage upload failed after retry.',
        },
      ],
      logs: [],
      jobIds: ['job-1', 'job-2'],
    })

    render(
      <SeedingCardView
        {...baseProps}
        run={run}
        onRetryUnfinishedJobs={onRetryUnfinishedJobs}
        onRetryJob={onRetryJob}
      />,
    )

    expect(screen.getByRole('button', { name: 'Retry unfinished jobs' })).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: `Retry ${formatSeedJobTitle('platformContentMedia', 2, 2)}` }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Retry unfinished jobs' }))
    fireEvent.click(screen.getByRole('button', { name: `Retry ${formatSeedJobTitle('platformContentMedia', 2, 2)}` }))

    expect(onRetryUnfinishedJobs).toHaveBeenCalledTimes(1)
    expect(onRetryJob).toHaveBeenCalledWith('job-2')
  })

  it('collapses the queue to keep only the progress summary visible', () => {
    const run = createRun({
      status: 'running',
      progress: { completed: 1, total: 2, percent: 50 },
      activeStepName: 'platformContentMedia (1/2)',
      jobs: undefined,
    })

    render(<SeedingCardView {...baseProps} run={run} />)

    expect(screen.getByRole('button', { name: 'Collapse queue' })).toBeInTheDocument()
    expect(screen.getByText(/Jobs \(2\)/)).toBeInTheDocument()
    expect(screen.getByText('Current step:')).toBeInTheDocument()
    expect(screen.getByText('Baseline seed')).toBeInTheDocument()
    expect(screen.getByText(formatSeedStepTitle('platformContentMedia (1/2)'))).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse queue' }))

    expect(screen.getByRole('button', { name: 'Expand queue' })).toBeInTheDocument()
    expect(screen.queryByText(/Jobs \(2\)/)).not.toBeInTheDocument()
    expect(screen.queryByText('Current step:')).not.toBeInTheDocument()
    expect(screen.queryByText(`1. ${formatSeedStepTitle('platformContentMedia (1/2)')}`)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50')
  })

  it('shows control metadata in log header', () => {
    render(
      <SeedingCardView
        {...baseProps}
        controls={{ maxLines: 120, showUnits: false, wrapLines: true }}
        logLines={[{ id: 'x', severity: 'INFO', text: 'line' }]}
      />,
    )

    expect(screen.getByText(/max lines 120/)).toBeInTheDocument()
    expect(screen.getByText(/units hidden/)).toBeInTheDocument()
    expect(screen.getByText(/wrap on/)).toBeInTheDocument()
    expect(screen.getByTestId('seeding-log-viewport')).toHaveStyle({ height: '320px' })
  })

  it('accepts completed run snapshots without collapsible details', () => {
    const run = createRun({
      status: 'completed',
      completedAt: new Date().toISOString(),
      activeJobId: undefined,
      activeStepName: undefined,
      progress: { completed: 2, total: 2, percent: 100 },
      jobs: undefined,
      jobIds: ['job-1', 'job-2'],
      hasActiveJob: false,
    })

    render(<SeedingCardView {...baseProps} run={run} />)

    expect(screen.getByText('Seed Baseline')).toBeInTheDocument()
    expect(screen.getByText('Completed at:')).toBeInTheDocument()
    expect(screen.getByText('Baseline seed')).toBeInTheDocument()
    expect(screen.getByText('completed')).toBeInTheDocument()
  })
})

describe('SeedingCard helpers', () => {
  it('modeFromNodeEnv maps production/test/development', () => {
    expect(modeFromNodeEnv('production')).toBe('production')
    expect(modeFromNodeEnv('test')).toBe('test')
    expect(modeFromNodeEnv('development')).toBe('development')
    expect(modeFromNodeEnv(undefined)).toBe('development')
  })

  it('modeFromRuntimeEnv resolves preview class from public runtime env', () => {
    const mode = modeFromRuntimeEnv({
      publicDeploymentEnv: undefined,
      nodeEnv: 'development',
      vercelEnv: 'preview',
    })

    expect(mode).toBe('preview')
  })

  it('getDemoSeedPolicy prefers production lockout', () => {
    expect(getDemoSeedPolicy({ mode: 'production', userType: 'platform' })).toEqual({
      canRunDemo: false,
      disabledTitle: 'Disabled in production',
    })

    expect(getDemoSeedPolicy({ mode: 'production', userType: 'clinic' })).toEqual({
      canRunDemo: false,
      disabledTitle: 'Disabled in production',
    })
  })

  it('normalizes widget controls with defaults and boundaries', () => {
    expect(normalizeSeedingWidgetControls(null)).toEqual({ maxLines: 500, showUnits: true, wrapLines: false })

    expect(normalizeSeedingWidgetControls({ maxLines: 3, showUnits: false, wrapLines: true })).toEqual({
      maxLines: 50,
      showUnits: false,
      wrapLines: true,
    })

    expect(normalizeSeedingWidgetControls({ maxLines: 999999 })).toEqual({
      maxLines: 5000,
      showUnits: true,
      wrapLines: false,
    })
  })
})
