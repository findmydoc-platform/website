'use client'
import React from 'react'
import { Button as PayloadButton } from '@payloadcms/ui/elements/Button'
import { Braces, Copy, FileText } from 'lucide-react'
import { Heading } from '@/components/atoms/Heading'

export type SeedingCardMode = 'development' | 'test' | 'production'

type SeedRunType = 'baseline' | 'demo'

export type DashboardUserType = 'platform' | 'clinic' | 'patient' | 'unknown'

interface SeedRunUnit {
  name: string
  created: number
  updated: number
}

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

export interface SeedRunSummary {
  type: SeedRunType
  reset?: boolean
  status: 'ok' | 'partial' | 'failed'
  startedAt: string
  finishedAt: string
  durationMs: number
  totals: { created: number; updated: number }
  units: SeedRunUnit[]
  warnings?: string[]
  failures?: string[]
}

export const modeFromNodeEnv = (nodeEnv: string | undefined): SeedingCardMode => {
  if (nodeEnv === 'production') return 'production'
  if (nodeEnv === 'test') return 'test'
  return 'development'
}

export const modeFromRuntimeEnv = (args: {
  nodeEnv: string | undefined
  vercelEnv: string | undefined
}): SeedingCardMode => {
  if (args.vercelEnv) return args.vercelEnv === 'production' ? 'production' : 'development'
  return modeFromNodeEnv(args.nodeEnv)
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
  lastRun: SeedRunSummary | null
  controls: SeedingWidgetControls
  logLines: SeedLogLine[]
  baselineButtonLabel: string
  demoButtonLabel: string
  onSeedBaseline: () => void
  onSeedDemo: () => void
  onRefreshStatus: () => void
  onCopyLogs: () => void
  onExportLogFile: () => void
  onExportJSONFile: () => void
}

export const SeedingCardView: React.FC<SeedingCardViewProps> = (props) => {
  const { canRunDemo, disabledTitle } = getDemoSeedPolicy({ mode: props.mode, userType: props.userType })
  const isProd = props.mode === 'production'
  const hasLogs = props.logLines.length > 0
  const terminalHeightPx = 320

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
    display: 'block',
    marginTop: '0.25rem',
    color: 'var(--theme-elevation-700)',
    fontSize: '0.8125rem',
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
    height: `${terminalHeightPx}px`,
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
        These actions may be destructive. In particular, a baseline reset will also delete demo data first to avoid
        integrity issues.
      </div>
      <div style={toolbarStyle}>
        <PayloadButton
          buttonStyle="primary"
          size="small"
          disabled={props.loading}
          margin={false}
          onClick={props.onSeedBaseline}
        >
          {props.baselineButtonLabel}
        </PayloadButton>
        {canRunDemo ? (
          <PayloadButton
            buttonStyle="primary"
            size="small"
            disabled={props.loading}
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
      <small style={statusMetaStyle}>
        Role: {props.userType} {isProd && '(production mode: demo disabled)'}
      </small>
      {props.error && (
        <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: 'var(--theme-error-500)' }}>
          Error: {props.error}
        </div>
      )}

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
