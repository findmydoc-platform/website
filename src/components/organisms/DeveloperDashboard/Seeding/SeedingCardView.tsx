'use client'
import React from 'react'
import { Button as PayloadButton } from '@payloadcms/ui/elements/Button'
import { Braces, Copy, FileText, Loader2, RotateCcw } from 'lucide-react'
import { Heading } from '@/components/atoms/Heading'
import {
  formatSeedChangeSummary,
  formatSeedJobTitle,
  formatSeedRunTitle,
  formatSeedStepTitle,
} from '@/endpoints/seed/utils/labels'
import { resolveClientRuntimeClass, resolveClientRuntimeEnvironment } from '@/features/runtimePolicy'
import type { SeedRunSnapshot } from '@/endpoints/seed/utils/state'

export type SeedingCardMode = 'development' | 'preview' | 'test' | 'production'

export type DashboardUserType = 'platform' | 'clinic' | 'patient' | 'unknown'

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR'

export type SeedLogLine = {
  id: string
  severity: LogSeverity
  text: string
}

export type SeedingWidgetControls = {
  maxLines: number
  showUnits: boolean
  wrapLines: boolean
}

const DEFAULT_WIDGET_CONTROLS: SeedingWidgetControls = {
  maxLines: 500,
  showUnits: true,
  wrapLines: false,
}

const MIN_MAX_LINES = 50
const MAX_MAX_LINES = 5000
const SEED_SUCCESS_COLOR = '#15803d'
const SEED_FAILURE_COLOR = '#dc2626'

export const normalizeSeedingWidgetControls = (value: unknown): SeedingWidgetControls => {
  if (typeof value !== 'object' || value === null) return DEFAULT_WIDGET_CONTROLS
  const candidate = value as Partial<Record<'maxLines' | 'showUnits' | 'wrapLines', unknown>>

  const parsedMaxLines =
    typeof candidate.maxLines === 'number' && Number.isFinite(candidate.maxLines)
      ? Math.min(MAX_MAX_LINES, Math.max(MIN_MAX_LINES, Math.trunc(candidate.maxLines)))
      : DEFAULT_WIDGET_CONTROLS.maxLines

  return {
    maxLines: parsedMaxLines,
    showUnits: typeof candidate.showUnits === 'boolean' ? candidate.showUnits : DEFAULT_WIDGET_CONTROLS.showUnits,
    wrapLines: typeof candidate.wrapLines === 'boolean' ? candidate.wrapLines : DEFAULT_WIDGET_CONTROLS.wrapLines,
  }
}

export type SeedRunSummary = SeedRunSnapshot

export const modeFromNodeEnv = (nodeEnv: string | undefined): SeedingCardMode => {
  if (nodeEnv === 'production') return 'production'
  if (nodeEnv === 'test') return 'test'
  return 'development'
}

export const modeFromRuntimeEnv = (args: {
  publicDeploymentEnv: string | undefined
  nodeEnv: string | undefined
  vercelEnv: string | undefined
}): SeedingCardMode => {
  const runtimeEnvironment = resolveClientRuntimeEnvironment({
    NEXT_PUBLIC_VERCEL_ENV: args.vercelEnv,
    NEXT_PUBLIC_DEPLOYMENT_ENV: args.publicDeploymentEnv,
    NODE_ENV: args.nodeEnv,
  })

  if (runtimeEnvironment === 'production') return 'production'
  if (runtimeEnvironment === 'test') return 'test'
  return resolveClientRuntimeClass({
    NEXT_PUBLIC_VERCEL_ENV: args.vercelEnv,
    NEXT_PUBLIC_DEPLOYMENT_ENV: args.publicDeploymentEnv,
    NODE_ENV: args.nodeEnv,
  }) === 'preview'
    ? 'preview'
    : 'development'
}

export const getDemoSeedPolicy = (args: {
  mode: SeedingCardMode
  userType: DashboardUserType
}): { canRunDemo: boolean; disabledTitle: string } => {
  if (args.mode === 'production') return { canRunDemo: false, disabledTitle: 'Disabled in production' }
  if (args.userType !== 'platform') return { canRunDemo: false, disabledTitle: 'Requires platform role' }
  return { canRunDemo: true, disabledTitle: '' }
}

export type SeedingCardViewProps = {
  mode: SeedingCardMode
  userType: DashboardUserType
  isPlatformUser: boolean
  loading: boolean
  error: string | null
  run: SeedRunSummary | null
  controls: SeedingWidgetControls
  logLines: SeedLogLine[]
  baselineButtonLabel: string
  demoButtonLabel: string
  onSeedBaseline: () => void
  onSeedDemo: () => void
  onRefreshStatus: () => void
  onRetryUnfinishedJobs: () => void
  onRetryJob: (jobId: string) => void
  onCopyLogs: () => void
  onExportLogFile: () => void
  onExportJSONFile: () => void
}

const isTerminalRunStatus = (status: SeedRunSnapshot['status']): boolean => {
  return status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled'
}

const formatRunStatus = (status: SeedRunSnapshot['status']): string => {
  if (status === 'completed') return 'completed'
  if (status === 'partial') return 'partial'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'running') return 'running'
  return 'queued'
}

const formatJobStatus = (status: SeedRunSnapshot['jobs'][number]['status']): string => {
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed') return 'failed'
  if (status === 'cancelled') return 'cancelled'
  if (status === 'skipped') return 'skipped'
  if (status === 'running') return 'running'
  return 'queued'
}

const formatProgressLabel = (run: SeedRunSummary | null): string => {
  if (!run) return 'No seed run recorded yet.'
  const completed = `${run.progress.completed}/${run.progress.total} jobs`
  return `${completed} · ${run.progress.percent}%`
}

const formatDateTime = (isoDate: string | undefined): string => {
  if (!isoDate) return 'n/a'
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleString()
}

const getProgressColor = (status: SeedRunSnapshot['status']): string => {
  if (status === 'failed' || status === 'cancelled') return SEED_FAILURE_COLOR
  if (status === 'partial') return 'var(--theme-warning-500)'
  if (status === 'completed') return SEED_SUCCESS_COLOR
  if (status === 'running') return 'var(--theme-elevation-700)'
  return 'var(--theme-elevation-500)'
}

const getJobStatusColor = (status: SeedRunSnapshot['jobs'][number]['status']): string => {
  if (status === 'failed') return SEED_FAILURE_COLOR
  if (status === 'cancelled') return SEED_FAILURE_COLOR
  if (status === 'skipped') return 'var(--theme-warning-500)'
  if (status === 'running') return 'var(--theme-elevation-700)'
  if (status === 'succeeded') return SEED_SUCCESS_COLOR
  return 'var(--theme-elevation-500)'
}

export const SeedingCardView: React.FC<SeedingCardViewProps> = (props) => {
  const [isQueueCollapsed, setIsQueueCollapsed] = React.useState(false)
  const queueCollapseId = React.useId()
  const { canRunDemo, disabledTitle } = getDemoSeedPolicy({ mode: props.mode, userType: props.userType })
  const isProd = props.mode === 'production'
  const hasLogs = props.logLines.length > 0
  const isRunActive = props.run ? !isTerminalRunStatus(props.run.status) : false
  const hasQueueDetails = Boolean(props.run && props.controls.showUnits && props.run.jobs.length > 0)
  const retryableJobs = props.run?.jobs.filter((job) => job.status === 'failed' || job.status === 'cancelled') ?? []
  const hasRetryableJobs = retryableJobs.length > 0
  const progressPercent = props.run?.progress.percent ?? 0
  const progressColor = getProgressColor(props.run?.status ?? 'queued')
  const progressLabel = formatProgressLabel(props.run)
  const runId = props.run?.runId ?? null
  const runTitle = props.run ? (props.run.title ?? formatSeedRunTitle(props.run.type, props.run.reset)) : null
  const isRunningRun = props.run?.status === 'running'

  React.useEffect(() => {
    setIsQueueCollapsed(false)
  }, [runId])

  const rootCardStyle: React.CSSProperties = {
    display: 'block',
  }

  const toolbarStyle: React.CSSProperties = {
    marginTop: '1rem',
    marginBottom: '0.5rem',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  }

  const statusMetaStyle: React.CSSProperties = {
    display: 'grid',
    gap: '0.45rem',
    marginTop: '0.5rem',
    border: '1px solid var(--theme-border-color)',
    borderRadius: 'var(--style-radius-m)',
    backgroundColor: 'var(--theme-elevation-50)',
    padding: '0.75rem 0.875rem',
    color: 'var(--theme-elevation-800)',
    fontSize: '0.8125rem',
  }

  const statusMetaRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '0.75rem',
    flexWrap: 'wrap',
  }

  const statusMetaLabelStyle: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'var(--theme-elevation-500)',
  }

  const statusMetaValueStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    justifyContent: 'flex-end',
    minWidth: 0,
    fontWeight: 600,
    textAlign: 'right',
    color: 'var(--theme-elevation-800)',
  }

  const statusRunningBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    border: '1px solid var(--theme-border-color)',
    backgroundColor: 'var(--theme-elevation-100)',
    color: 'var(--theme-elevation-700)',
    animation: 'seedRunningPulse 1.9s ease-in-out infinite',
    whiteSpace: 'nowrap',
  }

  const statusRunningIconStyle: React.CSSProperties = {
    animation: 'seedRunningSpin 1.9s linear infinite',
    flexShrink: 0,
  }

  const statusRunningTextStyle: React.CSSProperties = {
    lineHeight: 1,
  }

  const jobRunningBadgeStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.15rem 0.45rem',
    borderRadius: '999px',
    border: '1px solid rgba(21, 128, 61, 0.18)',
    backgroundColor: 'rgba(21, 128, 61, 0.06)',
    color: SEED_SUCCESS_COLOR,
    fontWeight: 700,
    animation: 'seedRunningPulse 1.9s ease-in-out infinite',
    whiteSpace: 'nowrap',
  }

  const progressCardStyle: React.CSSProperties = {
    marginTop: '0.875rem',
    padding: '0.875rem',
    border: '1px solid var(--theme-border-color)',
    borderRadius: 'var(--style-radius-m)',
    backgroundColor: 'var(--theme-elevation-50)',
  }

  const progressMetaStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
    marginBottom: '0.5rem',
    color: 'var(--theme-elevation-700)',
    fontSize: '0.8125rem',
  }

  const progressMetaRightStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  }

  const progressTrackStyle: React.CSSProperties = {
    height: '0.625rem',
    borderRadius: '999px',
    overflow: 'hidden',
    backgroundColor: 'var(--theme-elevation-200)',
  }

  const progressFillStyle: React.CSSProperties = {
    width: `${progressPercent}%`,
    height: '100%',
    backgroundColor: progressColor,
    transition: 'width 150ms ease',
  }

  const jobSummaryStyle: React.CSSProperties = {
    marginTop: '0.75rem',
    display: 'grid',
    gap: '0.5rem',
  }

  const jobSummaryGridStyle: React.CSSProperties = {
    display: 'grid',
    gap: '0.5rem',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  }

  const jobCardStyle = (status: SeedRunSnapshot['jobs'][number]['status']): React.CSSProperties => ({
    border: '1px solid var(--theme-border-color)',
    borderRadius: 'var(--style-radius-s)',
    backgroundColor: status === 'running' ? 'var(--theme-elevation-100)' : 'var(--theme-elevation-0)',
    padding: '0.625rem 0.75rem',
    color: 'var(--theme-elevation-800)',
    fontSize: '0.8125rem',
    boxShadow:
      status === 'running'
        ? 'inset 0 0 0 1px rgba(21, 128, 61, 0.16), 0 1px 0 rgba(0, 0, 0, 0.03)'
        : '0 1px 0 rgba(0, 0, 0, 0.03)',
    borderLeft: `4px solid ${getJobStatusColor(status)}`,
  })

  const jobTitleStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
    fontWeight: 600,
    marginBottom: '0.25rem',
  }

  const jobStatusActionsStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    flexShrink: 0,
  }

  const logPanelStyle: React.CSSProperties = {
    marginTop: '0.875rem',
    border: '1px solid var(--theme-border-color)',
    borderRadius: 'var(--style-radius-m)',
    backgroundColor: 'var(--theme-elevation-50)',
    overflow: 'hidden',
  }

  const logHeaderStyle: React.CSSProperties = {
    borderBottom: '1px solid var(--theme-border-color)',
    backgroundColor: 'var(--theme-elevation-100)',
    padding: '0.5rem 0.75rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '0.5rem',
  }

  const logMetaStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--theme-elevation-700)',
  }

  const logActionsStyle: React.CSSProperties = {
    display: 'inline-flex',
    gap: '0.25rem',
  }

  const logViewportStyle: React.CSSProperties = {
    height: '320px',
    overflow: 'auto',
    backgroundColor: 'var(--theme-elevation-0)',
    color: 'var(--theme-elevation-800)',
    padding: '0.75rem',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
    fontSize: '0.8125rem',
    lineHeight: 1.55,
    whiteSpace: props.controls.wrapLines ? 'pre-wrap' : 'pre',
    wordBreak: props.controls.wrapLines ? 'break-all' : 'normal',
  }

  const getSeverityColor = (severity: LogSeverity): string => {
    if (severity === 'ERROR') return 'var(--theme-error-500)'
    if (severity === 'WARN') return 'var(--theme-warning-500)'
    return 'var(--theme-elevation-700)'
  }

  if (!props.isPlatformUser) {
    return (
      <div className="card" style={rootCardStyle}>
        <Heading as="h4" align="left">
          Seeding
        </Heading>
        <div
          style={{
            marginTop: '0.75rem',
            border: '1px solid var(--theme-border-color)',
            borderRadius: 'var(--style-radius-m)',
            backgroundColor: 'var(--theme-elevation-0)',
            padding: '0.75rem',
            fontSize: '0.875rem',
            color: 'var(--theme-elevation-700)',
          }}
        >
          This widget is available to platform basic users only.
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={rootCardStyle}>
      <style>{`
        @keyframes seedRunningPulse {
          0%, 100% { opacity: 0.78; }
          50% { opacity: 1; }
        }

        @keyframes seedRunningSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
      <Heading as="h4" align="left">
        Seeding
      </Heading>
      <div
        style={{
          marginTop: '0.5rem',
          borderRadius: 'var(--style-radius-s)',
          border: '1px solid var(--theme-error-250)',
          backgroundColor: 'var(--theme-error-100)',
          color: 'var(--theme-error-650)',
          padding: '0.75rem',
          fontSize: '0.875rem',
        }}
      >
        These actions may be destructive. Baseline and demo seeding now run through the Payload job queue and are
        advanced asynchronously.
      </div>
      <div style={toolbarStyle}>
        <PayloadButton
          buttonStyle="primary"
          size="small"
          disabled={props.loading || isRunActive}
          margin={false}
          onClick={props.onSeedBaseline}
        >
          {props.baselineButtonLabel}
        </PayloadButton>
        {canRunDemo ? (
          <PayloadButton
            buttonStyle="primary"
            size="small"
            disabled={props.loading || isRunActive}
            margin={false}
            onClick={props.onSeedDemo}
          >
            {props.demoButtonLabel}
          </PayloadButton>
        ) : (
          <PayloadButton buttonStyle="primary" size="small" disabled margin={false} tooltip={disabledTitle}>
            {props.demoButtonLabel}
          </PayloadButton>
        )}
        <PayloadButton
          buttonStyle="primary"
          size="small"
          disabled={props.loading}
          margin={false}
          onClick={props.onRefreshStatus}
        >
          Refresh Status
        </PayloadButton>
      </div>
      <div
        style={statusMetaStyle}
        title={props.run ? `Run ID ${props.run.runId} · Queue ${props.run.queue}` : undefined}
      >
        <div style={statusMetaRowStyle}>
          <span style={statusMetaLabelStyle}>Role:</span>
          <span style={statusMetaValueStyle}>
            <span>{props.userType}</span>
            {isProd ? <span>(production mode: demo disabled)</span> : null}
          </span>
        </div>
        <div style={statusMetaRowStyle}>
          <span style={statusMetaLabelStyle}>Seed:</span>
          <span style={statusMetaValueStyle}>
            <span>{runTitle ?? 'No seed run recorded yet.'}</span>
            {props.run ? (
              <>
                <span>{' · '}</span>
                {isRunningRun ? (
                  <span style={statusRunningBadgeStyle}>
                    <Loader2 size={12} style={statusRunningIconStyle} aria-hidden />
                    <span style={statusRunningTextStyle}>Running</span>
                  </span>
                ) : (
                  <span>{formatRunStatus(props.run.status)}</span>
                )}
              </>
            ) : null}
          </span>
        </div>
      </div>
      {props.error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-error-500)' }}>
          Error: {props.error}
        </div>
      )}

      <div style={progressCardStyle}>
        <div style={progressMetaStyle}>
          <div>{progressLabel}</div>
          <div style={progressMetaRightStyle}>
            <div>{props.run ? `Status ${formatRunStatus(props.run.status)}` : 'Idle'}</div>
            {hasRetryableJobs ? (
              <PayloadButton
                buttonStyle="subtle"
                margin={false}
                size="xsmall"
                tooltip="Retry unfinished jobs"
                aria-label="Retry unfinished jobs"
                onClick={props.onRetryUnfinishedJobs}
              >
                Retry unfinished jobs
              </PayloadButton>
            ) : null}
            {hasQueueDetails ? (
              <PayloadButton
                aria-controls={`seed-queue-${queueCollapseId}`}
                aria-expanded={!isQueueCollapsed}
                buttonStyle="subtle"
                margin={false}
                size="xsmall"
                tooltip={isQueueCollapsed ? 'Expand queue' : 'Collapse queue'}
                onClick={() => setIsQueueCollapsed((value) => !value)}
              >
                {isQueueCollapsed ? 'Expand queue' : 'Collapse queue'}
              </PayloadButton>
            ) : null}
          </div>
        </div>
        <div
          style={progressTrackStyle}
          aria-label="Seed progress"
          role="progressbar"
          aria-valuemax={100}
          aria-valuemin={0}
          aria-valuenow={progressPercent}
        >
          <div style={progressFillStyle} />
        </div>
        {hasQueueDetails && !isQueueCollapsed && props.run ? (
          <div id={`seed-queue-${queueCollapseId}`} style={jobSummaryStyle}>
            {props.run.activeStepName ? (
              <div style={statusMetaRowStyle}>
                <span style={statusMetaLabelStyle}>Current step:</span>
                <span style={statusMetaValueStyle}>
                  {isRunningRun ? <Loader2 size={12} style={statusRunningIconStyle} aria-hidden /> : null}
                  <span>{formatSeedStepTitle(props.run.activeStepName)}</span>
                </span>
              </div>
            ) : null}
            {props.run.completedAt ? (
              <div style={statusMetaRowStyle}>
                <span style={statusMetaLabelStyle}>Completed at:</span>
                <span style={statusMetaValueStyle}>{formatDateTime(props.run.completedAt)}</span>
              </div>
            ) : null}
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--theme-elevation-700)' }}>
              Jobs ({props.run.jobs.length})
            </div>
            <div style={jobSummaryGridStyle}>
              {props.run.jobs.map((job) => (
                <div
                  key={job.id}
                  style={jobCardStyle(job.status)}
                  aria-busy={job.status === 'running' ? true : undefined}
                >
                  <div style={jobTitleStyle}>
                    <span>
                      {job.order}. {job.title ?? formatSeedJobTitle(job.stepName, job.chunkIndex, job.chunkTotal)}
                    </span>
                    <span style={jobStatusActionsStyle}>
                      {job.status === 'running' ? (
                        <span style={jobRunningBadgeStyle}>
                          <Loader2 size={12} style={statusRunningIconStyle} aria-hidden />
                          <span style={statusRunningTextStyle}>{formatJobStatus(job.status)}</span>
                        </span>
                      ) : (
                        <span style={{ color: getJobStatusColor(job.status) }}>{formatJobStatus(job.status)}</span>
                      )}
                      {job.status === 'failed' || job.status === 'cancelled' ? (
                        <PayloadButton
                          aria-label={`Retry ${job.title ?? formatSeedJobTitle(job.stepName, job.chunkIndex, job.chunkTotal)}`}
                          buttonStyle="subtle"
                          margin={false}
                          size="xsmall"
                          tooltip={`Retry ${job.title ?? formatSeedJobTitle(job.stepName, job.chunkIndex, job.chunkTotal)}`}
                          onClick={() => props.onRetryJob(job.id)}
                        >
                          <RotateCcw size={14} />
                        </PayloadButton>
                      ) : null}
                    </span>
                  </div>
                  <div style={{ color: 'var(--theme-elevation-700)' }}>
                    {formatSeedChangeSummary(job.created, job.updated)}
                  </div>
                  {(job.warnings.length > 0 || job.failures.length > 0) && (
                    <div style={{ marginTop: '0.25rem', color: 'var(--theme-elevation-700)' }}>
                      {job.warnings.length > 0 ? `${job.warnings.length} warning(s)` : ''}
                      {job.warnings.length > 0 && job.failures.length > 0 ? ' · ' : ''}
                      {job.failures.length > 0 ? `${job.failures.length} failure(s)` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div style={logPanelStyle}>
        <div style={logHeaderStyle}>
          <div style={logMetaStyle}>
            Logs ({props.logLines.length}) · max lines {props.controls.maxLines}
            {!props.controls.showUnits ? ' · units hidden' : ''}
            {props.controls.wrapLines ? ' · wrap on' : ' · wrap off'}
          </div>
          <div style={logActionsStyle} data-testid="seeding-log-actions">
            <PayloadButton
              aria-label="Copy logs"
              buttonStyle="subtle"
              disabled={!hasLogs || props.loading}
              icon={<Copy size={14} />}
              iconStyle="without-border"
              margin={false}
              size="xsmall"
              tooltip="Copy logs"
              onClick={props.onCopyLogs}
            />
            <PayloadButton
              aria-label="Export .log"
              buttonStyle="subtle"
              disabled={!hasLogs || props.loading}
              icon={<FileText size={14} />}
              iconStyle="without-border"
              margin={false}
              size="xsmall"
              tooltip="Export .log"
              onClick={props.onExportLogFile}
            />
            <PayloadButton
              aria-label="Export .json"
              buttonStyle="subtle"
              disabled={!hasLogs || props.loading}
              icon={<Braces size={14} />}
              iconStyle="without-border"
              margin={false}
              size="xsmall"
              tooltip="Export .json"
              onClick={props.onExportJSONFile}
            />
          </div>
        </div>
        <div data-testid="seeding-log-viewport" style={logViewportStyle}>
          {props.logLines.length > 0 ? (
            props.logLines.map((line) => (
              <div key={line.id} style={{ display: 'flex', gap: '0.5rem' }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: '4.25rem',
                    flexShrink: 0,
                    fontWeight: 700,
                    color: getSeverityColor(line.severity),
                  }}
                >
                  [{line.severity}]
                </span>
                <span>{line.text}</span>
              </div>
            ))
          ) : (
            <div style={{ color: 'var(--theme-elevation-500)' }}>No logs available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
