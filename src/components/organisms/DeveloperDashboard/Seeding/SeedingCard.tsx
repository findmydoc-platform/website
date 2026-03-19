'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
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
import { formatSeedRetryTitle, formatSeedRunTitle, formatSeedStepTitle } from '@/endpoints/seed/utils/labels'

type SeedRunType = SeedRunSummary['type']

type SeedingCardProps = {
  mode?: SeedingCardMode
  controls?: unknown
  forcedUserType?: DashboardUserType
}

const STORAGE_KEY = 'developer-dashboard:seed-run-id'
const POLL_INTERVAL_MS = 1000

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

const isTerminalRunStatus = (status: SeedRunSummary['status']): boolean => {
  return status === 'completed' || status === 'partial' || status === 'failed' || status === 'cancelled'
}

const isSeedJobStatus = (value: unknown): value is SeedRunSummary['jobs'][number]['status'] => {
  return (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'cancelled' ||
    value === 'skipped'
  )
}

const isSeedRunSnapshot = (value: unknown): value is SeedRunSummary => {
  if (typeof value !== 'object' || value === null) return false

  const maybe = value as Partial<Record<string, unknown>>
  const progress = maybe.progress as Partial<Record<string, unknown>> | undefined

  return (
    typeof maybe.runId === 'string' &&
    typeof maybe.queue === 'string' &&
    (maybe.type === 'baseline' || maybe.type === 'demo') &&
    typeof maybe.reset === 'boolean' &&
    (maybe.status === 'queued' ||
      maybe.status === 'running' ||
      maybe.status === 'completed' ||
      maybe.status === 'partial' ||
      maybe.status === 'failed' ||
      maybe.status === 'cancelled') &&
    typeof maybe.createdAt === 'string' &&
    Array.isArray(maybe.jobs) &&
    Array.isArray(maybe.logs) &&
    typeof progress === 'object' &&
    progress !== null &&
    typeof progress.completed === 'number' &&
    typeof progress.total === 'number' &&
    typeof progress.percent === 'number' &&
    maybe.jobs.every((job) => {
      if (typeof job !== 'object' || job === null) return false
      const candidate = job as Partial<Record<string, unknown>>
      return (
        typeof candidate.id === 'string' &&
        typeof candidate.stepName === 'string' &&
        typeof candidate.order === 'number' &&
        isSeedJobStatus(candidate.status)
      )
    }) &&
    maybe.logs.every((entry) => {
      if (typeof entry !== 'object' || entry === null) return false
      const candidate = entry as Partial<Record<string, unknown>>
      return (
        typeof candidate.id === 'string' &&
        (candidate.severity === 'INFO' || candidate.severity === 'WARN' || candidate.severity === 'ERROR') &&
        typeof candidate.text === 'string'
      )
    })
  )
}

const clipLogLines = (lines: SeedLogLine[], maxLines: number): SeedLogLine[] => {
  if (lines.length <= maxLines) return lines

  const skipped = lines.length - maxLines
  return [
    { id: 'truncated', severity: 'INFO', text: `Output truncated: ${skipped} older line(s) hidden.` },
    ...lines.slice(lines.length - maxLines),
  ]
}

const formatLogEntry = (entry: SeedRunSummary['logs'][number]): SeedLogLine => {
  const parts: string[] = []
  if (entry.jobId) {
    parts.push(`#${entry.jobId.slice(0, 8)}`)
  }
  if (entry.title) {
    parts.push(entry.title)
  } else if (entry.stepName) {
    parts.push(formatSeedStepTitle(entry.stepName))
  }
  if (typeof entry.chunkIndex === 'number' && typeof entry.chunkTotal === 'number') {
    parts.push(`chunk ${entry.chunkIndex}/${entry.chunkTotal}`)
  }

  const prefix = parts.length > 0 ? `${parts.join(' · ')} · ` : ''

  return {
    id: entry.id,
    severity: entry.severity,
    text: `${prefix}${entry.text}`,
  }
}

const buildLogLines = (args: {
  error: string | null
  run: SeedRunSummary | null
  controls: SeedingWidgetControls
}): SeedLogLine[] => {
  const lines: SeedLogLine[] = []

  if (args.error) {
    lines.push({ id: 'transport-error', severity: 'ERROR', text: `Seed request failed: ${args.error}` })
  }

  if (!args.run) {
    return clipLogLines(lines, args.controls.maxLines)
  }

  for (const entry of args.run.logs) {
    lines.push(formatLogEntry(entry))
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

const readStoredRunId = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const writeStoredRunId = (runId: string | null): void => {
  if (typeof window === 'undefined') return
  try {
    if (runId) {
      window.localStorage.setItem(STORAGE_KEY, runId)
    } else {
      window.localStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // Ignore storage failures and keep the run purely server-backed.
  }
}

export const SeedingCard: React.FC<SeedingCardProps> = (props) => {
  const [loading, setLoading] = useState(false)
  const [run, setRun] = useState<SeedRunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userType, setUserType] = useState<DashboardUserType>(props.forcedUserType ?? 'unknown')
  const [baselineSeededThisSession, setBaselineSeededThisSession] = useState(false)
  const [demoSeededThisSession, setDemoSeededThisSession] = useState(false)
  const requestLockRef = useRef(false)

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

  const applyRunSnapshot = useCallback((snapshot: SeedRunSummary | null) => {
    setRun(snapshot)
    if (snapshot && !isTerminalRunStatus(snapshot.status)) {
      writeStoredRunId(snapshot.runId)
    } else {
      writeStoredRunId(null)
    }
  }, [])

  const runRequest = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | null> => {
    if (requestLockRef.current) {
      return null
    }

    requestLockRef.current = true
    setLoading(true)
    try {
      return await operation()
    } finally {
      requestLockRef.current = false
      setLoading(false)
    }
  }, [])

  const loadSeedRun = useCallback(
    async (requestedRunId?: string | null): Promise<SeedRunSummary | null> => {
      setError(null)

      try {
        const params = new URLSearchParams()
        if (requestedRunId) {
          params.set('runId', requestedRunId)
        }

        const query = params.toString()
        const data = await fetchJSON(query.length > 0 ? `/api/seed?${query}` : '/api/seed')
        if (isSeedRunSnapshot(data)) {
          applyRunSnapshot(data)
          return data
        }

        if (typeof data === 'object' && data !== null && 'message' in data) {
          applyRunSnapshot(null)
          return null
        }

        throw new Error('Unexpected response')
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : String(loadError)
        setError(message)
        if (requestedRunId) {
          applyRunSnapshot(null)
        }
        return null
      }
    },
    [applyRunSnapshot],
  )

  const advanceSeedRun = useCallback(
    async (requestedRunId?: string | null): Promise<SeedRunSummary | null> => {
      return runRequest(async () => {
        setError(null)

        try {
          const params = new URLSearchParams()
          if (requestedRunId) {
            params.set('runId', requestedRunId)
          }

          const query = params.toString()
          const data = await fetchJSON(query.length > 0 ? `/api/seed/advance?${query}` : '/api/seed/advance')
          if (isSeedRunSnapshot(data)) {
            applyRunSnapshot(data)
            return data
          }

          if (typeof data === 'object' && data !== null && 'message' in data) {
            applyRunSnapshot(null)
            return null
          }

          throw new Error('Unexpected response')
        } catch (advanceError: unknown) {
          const message = advanceError instanceof Error ? advanceError.message : String(advanceError)
          setError(message)
          return null
        }
      })
    },
    [applyRunSnapshot, runRequest],
  )

  const advanceSeedRunIfIdle = useCallback(
    async (snapshot: SeedRunSummary | null): Promise<SeedRunSummary | null> => {
      if (!snapshot) return null
      if (isTerminalRunStatus(snapshot.status)) return snapshot
      if (snapshot.hasActiveJob) return snapshot
      if (requestLockRef.current) return snapshot

      return advanceSeedRun(snapshot.runId)
    },
    [advanceSeedRun],
  )

  const activeRunId = run?.runId ?? null
  const activeRunStatus = run?.status ?? null

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

  useEffect(() => {
    if (!isPlatform) return

    const storedRunId = readStoredRunId()
    void loadSeedRun(storedRunId).then((snapshot) => {
      void advanceSeedRunIfIdle(snapshot)
    })
  }, [advanceSeedRunIfIdle, isPlatform, loadSeedRun])

  useEffect(() => {
    if (!activeRunId || !activeRunStatus || isTerminalRunStatus(activeRunStatus)) {
      return
    }

    // Poll status independently so the UI can show "Running" while advance() is still in flight.
    const timer = window.setInterval(() => {
      void loadSeedRun(activeRunId).then((snapshot) => {
        void advanceSeedRunIfIdle(snapshot)
      })
    }, POLL_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [advanceSeedRunIfIdle, activeRunId, activeRunStatus, loadSeedRun])

  const runSeed = useCallback(
    async (type: SeedRunType, opts?: { reset?: boolean }) => {
      return runRequest(async () => {
        setError(null)

        const params = new URLSearchParams({ type })
        if (opts?.reset) params.set('reset', '1')

        try {
          const data = await fetchJSON(`/api/seed?${params.toString()}`, { method: 'POST' })
          if (!isSeedRunSnapshot(data)) {
            throw new Error('Unexpected response')
          }

          applyRunSnapshot(data)
          if (type === 'baseline') setBaselineSeededThisSession(true)
          if (type === 'demo') setDemoSeededThisSession(true)

          toast.success(
            `Seed run queued: ${formatSeedRunTitle(type, opts?.reset ?? false)} · ${data.progress.total} job(s)`,
          )

          if (!isTerminalRunStatus(data.status)) {
            setTimeout(() => {
              void advanceSeedRunIfIdle(data)
            }, 0)
          }

          return data
        } catch (seedError: unknown) {
          const message = seedError instanceof Error ? seedError.message : String(seedError)
          setError(message)

          if (message.includes('already active')) {
            setTimeout(() => {
              void loadSeedRun(undefined)
            }, 0)
          }

          toast.error(`Seed failed: ${message}`)
          return null
        }
      })
    },
    [advanceSeedRunIfIdle, applyRunSnapshot, loadSeedRun, runRequest],
  )

  const retrySeedRun = useCallback(
    async (runId: string, jobId?: string) => {
      return runRequest(async () => {
        setError(null)

        try {
          const params = new URLSearchParams({ runId })
          if (jobId) {
            params.set('jobId', jobId)
          }

          const data = await fetchJSON(`/api/seed/retry?${params.toString()}`, { method: 'POST' })
          if (!isSeedRunSnapshot(data)) {
            throw new Error('Unexpected response')
          }

          applyRunSnapshot(data)
          toast.success(
            `Retry queued: ${data.title ?? formatSeedRetryTitle(formatSeedRunTitle(data.type, data.reset))} · ${data.progress.total} job(s)`,
          )

          if (!isTerminalRunStatus(data.status)) {
            setTimeout(() => {
              void advanceSeedRunIfIdle(data)
            }, 0)
          }

          return data
        } catch (retryError: unknown) {
          const message = retryError instanceof Error ? retryError.message : String(retryError)
          setError(message)
          toast.error(`Retry failed: ${message}`)
          return null
        }
      })
    },
    [advanceSeedRunIfIdle, applyRunSnapshot, runRequest],
  )

  const canReset = mode !== 'production'

  const baselineResetModalSlug = 'developer-dashboard-seeding-baseline-reset'
  const demoResetModalSlug = 'developer-dashboard-seeding-demo-reset'

  const onSeedBaseline = useCallback(async () => {
    if (canReset && baselineSeededThisSession) {
      openModal(baselineResetModalSlug)
      return
    }

    await runSeed('baseline')
  }, [baselineResetModalSlug, baselineSeededThisSession, canReset, openModal, runSeed])

  const onConfirmBaselineReset = useCallback(async () => {
    await runSeed('baseline', { reset: true })
  }, [runSeed])

  const onSeedDemo = useCallback(async () => {
    if (!demoSeededThisSession) {
      await runSeed('demo')
      return
    }

    if (canReset) openModal(demoResetModalSlug)
  }, [canReset, demoResetModalSlug, demoSeededThisSession, openModal, runSeed])

  const onConfirmDemoReset = useCallback(async () => {
    await runSeed('demo', { reset: true })
  }, [runSeed])

  const baselineButtonLabel = canReset && baselineSeededThisSession ? 'Reseed Baseline (Reset)' : 'Seed Baseline'
  const demoButtonLabel = demoSeededThisSession ? 'Reseed Demo (Reset)' : 'Seed Demo'

  const logLines = buildLogLines({ error, run, controls })

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
        run,
        error,
        lines: logLines,
      },
      null,
      2,
    )

    downloadFile(`seed-logs-${timestamp}.json`, jsonPayload, 'application/json;charset=utf-8')
    toast.success('Exported .json file')
  }, [controls, error, logLines, run])

  return (
    <>
      <SeedingCardView
        mode={mode}
        userType={userType}
        isPlatformUser={isPlatform}
        loading={loading}
        error={error}
        run={run}
        controls={controls}
        logLines={logLines}
        baselineButtonLabel={baselineButtonLabel}
        demoButtonLabel={demoButtonLabel}
        onSeedBaseline={onSeedBaseline}
        onSeedDemo={onSeedDemo}
        onRetryUnfinishedJobs={() => {
          if (run?.runId) {
            void retrySeedRun(run.runId)
          }
        }}
        onRetryJob={(jobId) => {
          if (run?.runId) {
            void retrySeedRun(run.runId, jobId)
          }
        }}
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
