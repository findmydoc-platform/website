'use client'
import React from 'react'
import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

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
  const { canRunDemo, disabledTitle } = getDemoSeedPolicy({ mode: props.mode, userType: 'platform' })
  const isProd = props.mode === 'production'
  const hasLogs = props.logLines.length > 0

  if (!props.isPlatformUser) {
    return (
      <div className="rounded-sm border border-border bg-card p-4">
        <Heading as="h4" align="left">
          Seeding
        </Heading>
        <div className="mt-3 rounded-sm border border-border bg-muted/30 p-3 text-sm">
          This widget is available to platform basic users only.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <Heading as="h4" align="left">
        Seeding
      </Heading>
      <div className="mt-2 rounded-sm border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
        These actions may be destructive. In particular, a baseline reset will also delete demo data first to avoid
        integrity issues.
      </div>
      <div className="mt-4 mb-2 flex flex-wrap gap-2">
        <Button disabled={props.loading} onClick={props.onSeedBaseline}>
          {props.baselineButtonLabel}
        </Button>
        {canRunDemo ? (
          <Button disabled={props.loading} onClick={props.onSeedDemo}>
            {props.demoButtonLabel}
          </Button>
        ) : (
          <Button disabled className="opacity-50" title={disabledTitle}>
            {props.demoButtonLabel}
          </Button>
        )}
        <Button disabled={props.loading} onClick={props.onRefreshStatus}>
          Refresh Status
        </Button>
        <Button disabled={!hasLogs || props.loading} hoverEffect="none" variant="outline" onClick={props.onCopyLogs}>
          Copy Logs
        </Button>
        <Button
          disabled={!hasLogs || props.loading}
          hoverEffect="none"
          variant="outline"
          onClick={props.onExportLogFile}
        >
          Export .log
        </Button>
        <Button
          disabled={!hasLogs || props.loading}
          hoverEffect="none"
          variant="outline"
          onClick={props.onExportJSONFile}
        >
          Export .json
        </Button>
      </div>
      <small>
        Role: {props.userType} {isProd && '(production mode: demo disabled)'}
      </small>
      {props.error && <div className="mt-2 text-sm text-error">Error: {props.error}</div>}

      <div className="mt-4 rounded-sm border border-border">
        <div className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium">
          Logs ({props.logLines.length}) · max lines {props.controls.maxLines}
          {!props.controls.showUnits ? ' · units hidden' : ''}
          {props.controls.wrapLines ? ' · wrap on' : ' · wrap off'}
        </div>
        <div
          className={cn(
            'max-h-72 overflow-auto bg-background px-3 py-2 font-mono text-xs leading-5',
            props.controls.wrapLines ? 'break-all whitespace-pre-wrap' : 'whitespace-pre',
          )}
        >
          {props.logLines.length > 0 ? (
            props.logLines.map((line) => (
              <div key={line.id} className="flex gap-2">
                <span
                  className={cn(
                    'inline-block w-14 shrink-0 font-semibold',
                    line.severity === 'ERROR' && 'text-destructive',
                    line.severity === 'WARN' && 'text-yellow-600',
                    line.severity === 'INFO' && 'text-foreground/80',
                  )}
                >
                  [{line.severity}]
                </span>
                <span>{line.text}</span>
              </div>
            ))
          ) : (
            <div className="text-foreground/70">No logs available.</div>
          )}
        </div>
      </div>
    </div>
  )
}
