'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { ConfirmationModal, toast, useAuth, useModal } from '@payloadcms/ui'

import {
  normalizeSeedingWidgetControls,
  SeedingCardView,
  modeFromRuntimeEnv,
  type DashboardUserType,
  type SeedLogLine,
  type SeedingCardMode,
  type SeedingWidgetControls,
  type SeedRunSummary,
} from './SeedingCardView'

type SeedRunType = SeedRunSummary['type']

type SeedingCardProps = {
  mode?: SeedingCardMode
  controls?: unknown
  forcedUserType?: DashboardUserType
}

const fetchJSON = async (url: string, opts?: RequestInit): Promise<unknown> => {
  const res = await fetch(url, { credentials: 'include', ...opts })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`.trim()
    try {
      const json: unknown = await res.json()
      if (typeof json === 'object' && json !== null && 'error' in json && typeof json.error === 'string') {
        msg = json.error
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(msg)
  }
  return (await res.json()) as unknown
}

const isDashboardUserType = (value: unknown): value is DashboardUserType => {
  return value === 'platform' || value === 'clinic' || value === 'patient' || value === 'unknown'
}

const isSeedRunSummary = (value: unknown): value is SeedRunSummary => {
  if (typeof value !== 'object' || value === null) return false

  const maybe = value as Partial<Record<string, unknown>>

  const hasValidTotals =
    typeof maybe.totals === 'object' &&
    maybe.totals !== null &&
    typeof (maybe.totals as Record<string, unknown>).created === 'number' &&
    typeof (maybe.totals as Record<string, unknown>).updated === 'number'

  const hasValidUnits = Array.isArray(maybe.units)

  const hasValidWarnings =
    maybe.warnings === undefined ||
    (Array.isArray(maybe.warnings) && maybe.warnings.every((warning) => typeof warning === 'string'))

  const hasValidFailures =
    maybe.failures === undefined ||
    (Array.isArray(maybe.failures) && maybe.failures.every((failure) => typeof failure === 'string'))

  return (
    (maybe.type === 'baseline' || maybe.type === 'demo') &&
    typeof maybe.startedAt === 'string' &&
    typeof maybe.finishedAt === 'string' &&
    (maybe.status === 'ok' || maybe.status === 'partial' || maybe.status === 'failed') &&
    typeof maybe.durationMs === 'number' &&
    hasValidTotals &&
    hasValidUnits &&
    hasValidWarnings &&
    hasValidFailures
  )
}

const formatDateTime = (isoDate: string): string => {
  const parsed = new Date(isoDate)
  if (Number.isNaN(parsed.getTime())) return isoDate
  return parsed.toLocaleString()
}

const clipLogLines = (lines: SeedLogLine[], maxLines: number): SeedLogLine[] => {
  if (lines.length <= maxLines) return lines

  const skipped = lines.length - maxLines
  return [
    { id: 'truncated', severity: 'INFO', text: `Output truncated: ${skipped} older line(s) hidden.` },
    ...lines.slice(lines.length - maxLines),
  ]
}

const buildLogLines = (args: {
  error: string | null
  lastRun: SeedRunSummary | null
  controls: SeedingWidgetControls
}): SeedLogLine[] => {
  const lines: SeedLogLine[] = []
  let cursor = 0

  const push = (severity: SeedLogLine['severity'], text: string) => {
    lines.push({ id: `${severity.toLowerCase()}-${cursor++}`, severity, text })
  }

  if (args.error) {
    push('ERROR', `Seed request failed: ${args.error}`)
  }

  if (!args.lastRun) {
    push('INFO', 'No seed run recorded yet.')
    return clipLogLines(lines, args.controls.maxLines)
  }

  const run = args.lastRun

  push(
    'INFO',
    `Run ${formatDateTime(run.finishedAt)} · type=${run.type}${run.reset ? '+reset' : ''} · status=${run.status}`,
  )
  push('INFO', `Duration ${run.durationMs}ms · totals created=${run.totals.created} updated=${run.totals.updated}`)
  push('INFO', `Window ${formatDateTime(run.startedAt)} → ${formatDateTime(run.finishedAt)}`)

  for (const warning of run.warnings ?? []) {
    push('WARN', warning)
  }

  for (const failure of run.failures ?? []) {
    push('ERROR', failure)
  }

  if (args.controls.showUnits) {
    for (const unit of run.units) {
      push('INFO', `unit ${unit.name}: +${unit.created} / ~${unit.updated}`)
    }
  }

  return clipLogLines(lines, args.controls.maxLines)
}

const toLogText = (lines: SeedLogLine[]): string => lines.map((line) => `[${line.severity}] ${line.text}`).join('\n')

const downloadFile = (filename: string, content: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename

  document.body.append(anchor)
  anchor.click()
  anchor.remove()

  URL.revokeObjectURL(url)
}

export const SeedingCard: React.FC<SeedingCardProps> = (props) => {
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<SeedRunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userType, setUserType] = useState<DashboardUserType>(props.forcedUserType ?? 'unknown')
  const [baselineSeededThisSession, setBaselineSeededThisSession] = useState(false)
  const [demoSeededThisSession, setDemoSeededThisSession] = useState(false)

  const { user } = useAuth()
  const { openModal } = useModal()

  const controls = normalizeSeedingWidgetControls(props.controls)

  const mode =
    props.mode ??
    modeFromRuntimeEnv({
      publicDeploymentEnv: process.env.NEXT_PUBLIC_DEPLOYMENT_ENV,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV,
    })

  const isPlatform = userType === 'platform'

  useEffect(() => {
    if (props.forcedUserType) {
      if (userType !== props.forcedUserType) setUserType(props.forcedUserType)
      return
    }

    if (!user?.userType) {
      if (userType !== 'unknown') setUserType('unknown')
      return
    }

    const nextType: DashboardUserType = isDashboardUserType(user.userType) ? user.userType : 'unknown'
    if (userType !== nextType) setUserType(nextType)
  }, [props.forcedUserType, user?.userType, userType])

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchJSON('/api/seed')
      if (isSeedRunSummary(data)) setLastRun(data)
    } catch {
      // no-op: no prior run is valid
    }
  }, [])

  useEffect(() => {
    if (!isPlatform) return
    loadStatus()
  }, [isPlatform, loadStatus])

  const runSeed = useCallback(async (type: SeedRunType, opts?: { reset?: boolean }) => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({ type })
    if (opts?.reset) params.set('reset', '1')

    try {
      const data = await fetchJSON(`/api/seed?${params.toString()}`, { method: 'POST' })
      if (!isSeedRunSummary(data)) {
        setError('Unexpected response')
        toast.error('Seed failed: Unexpected response')
        return null
      }

      setLastRun(data)

      if (data.status === 'ok') {
        toast.success(`${type} seed finished: ${data.totals.created} created / ${data.totals.updated} updated`)
      } else if (data.status === 'partial') {
        toast.warning(`Partial ${type} seed: ${(data.failures ?? []).length} failures`)
      }

      return data
    } catch (seedError: unknown) {
      const message = seedError instanceof Error ? seedError.message : String(seedError)
      setError(message)
      toast.error(`Seed failed: ${message}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const canReset = mode !== 'production'

  const baselineResetModalSlug = 'developer-dashboard-seeding-baseline-reset'
  const demoResetModalSlug = 'developer-dashboard-seeding-demo-reset'

  const onSeedBaseline = useCallback(async () => {
    if (canReset && baselineSeededThisSession) {
      openModal(baselineResetModalSlug)
      return
    }

    const result = await runSeed('baseline')
    if (result) setBaselineSeededThisSession(true)
  }, [baselineResetModalSlug, baselineSeededThisSession, canReset, openModal, runSeed])

  const onConfirmBaselineReset = useCallback(async () => {
    const result = await runSeed('baseline', { reset: true })
    if (result) setBaselineSeededThisSession(true)
  }, [runSeed])

  const onSeedDemo = useCallback(async () => {
    if (!demoSeededThisSession) {
      const result = await runSeed('demo')
      if (result) setDemoSeededThisSession(true)
      return
    }

    if (canReset) openModal(demoResetModalSlug)
  }, [canReset, demoResetModalSlug, demoSeededThisSession, openModal, runSeed])

  const onConfirmDemoReset = useCallback(async () => {
    const result = await runSeed('demo', { reset: true })
    if (result) setDemoSeededThisSession(true)
  }, [runSeed])

  const baselineButtonLabel = canReset && baselineSeededThisSession ? 'Reseed Baseline (Reset)' : 'Seed Baseline'
  const demoButtonLabel = demoSeededThisSession ? 'Reseed Demo (Reset)' : 'Seed Demo'

  const logLines = buildLogLines({ error, lastRun, controls })

  const onCopyLogs = useCallback(async () => {
    try {
      if (typeof navigator === 'undefined' || !navigator.clipboard) {
        toast.error('Copy failed: Clipboard API unavailable')
        return
      }

      await navigator.clipboard.writeText(toLogText(logLines))
      toast.success('Logs copied to clipboard')
    } catch (copyError: unknown) {
      const message = copyError instanceof Error ? copyError.message : String(copyError)
      toast.error(`Copy failed: ${message}`)
    }
  }, [logLines])

  const onExportLogFile = useCallback(() => {
    const timestamp = new Date().toISOString().replaceAll(':', '-')
    downloadFile(`seed-logs-${timestamp}.log`, toLogText(logLines), 'text/plain;charset=utf-8')
    toast.success('Exported .log file')
  }, [logLines])

  const onExportJSONFile = useCallback(() => {
    const timestamp = new Date().toISOString().replaceAll(':', '-')

    const jsonPayload = JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        controls,
        lastRun,
        error,
        lines: logLines,
      },
      null,
      2,
    )

    downloadFile(`seed-logs-${timestamp}.json`, jsonPayload, 'application/json;charset=utf-8')
    toast.success('Exported .json file')
  }, [controls, error, lastRun, logLines])

  return (
    <>
      <SeedingCardView
        mode={mode}
        userType={userType}
        isPlatformUser={isPlatform}
        loading={loading}
        error={error}
        lastRun={lastRun}
        controls={controls}
        logLines={logLines}
        baselineButtonLabel={baselineButtonLabel}
        demoButtonLabel={demoButtonLabel}
        onSeedBaseline={onSeedBaseline}
        onSeedDemo={onSeedDemo}
        onRefreshStatus={loadStatus}
        onCopyLogs={onCopyLogs}
        onExportLogFile={onExportLogFile}
        onExportJSONFile={onExportJSONFile}
      />

      <ConfirmationModal
        heading="Reset baseline seed?"
        body={
          'This will delete demo data first (posts, clinics, doctors, reviews, etc.), then delete baseline reference data (treatments, categories, tags, etc.), and finally re-seed baseline. Use only in non-production environments.'
        }
        confirmLabel="Confirm reset"
        modalSlug={baselineResetModalSlug}
        onConfirm={onConfirmBaselineReset}
      />

      <ConfirmationModal
        heading="Reset demo seed?"
        body={
          'This will delete demo data (posts, clinics, doctors, reviews, etc.) and then re-seed it. Baseline reference data is not removed.'
        }
        confirmLabel="Confirm reset"
        modalSlug={demoResetModalSlug}
        onConfirm={onConfirmDemoReset}
      />
    </>
  )
}

export type { SeedRunSummary, SeedingCardMode, DashboardUserType, SeedingWidgetControls } from './SeedingCardView'
export { SeedingCardView, getDemoSeedPolicy, modeFromNodeEnv, modeFromRuntimeEnv } from './SeedingCardView'
