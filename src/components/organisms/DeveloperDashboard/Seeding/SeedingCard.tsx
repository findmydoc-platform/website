'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { toast, useAuth } from '@payloadcms/ui'

import {
  SeedingCardView,
  modeFromNodeEnv,
  type DashboardUserType,
  type SeedingCardMode,
  type SeedRunSummary,
} from './SeedingCardView'

type SeedRunType = SeedRunSummary['type']

const fetchJSON = async (url: string, opts?: RequestInit): Promise<unknown> => {
  const res = await fetch(url, { credentials: 'include', ...opts })
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`.trim()
    try {
      const json: unknown = await res.json()
      if (typeof json === 'object' && json !== null && 'error' in json && typeof json.error === 'string')
        msg = json.error
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

  return (
    (maybe.type === 'baseline' || maybe.type === 'demo') &&
    typeof maybe.startedAt === 'string' &&
    typeof maybe.finishedAt === 'string' &&
    (maybe.status === 'ok' || maybe.status === 'partial' || maybe.status === 'failed') &&
    typeof maybe.baselineFailed === 'boolean' &&
    typeof maybe.durationMs === 'number' &&
    hasValidTotals &&
    hasValidUnits
  )
}

export const SeedingCard: React.FC<{ mode?: SeedingCardMode }> = (props) => {
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<SeedRunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userType, setUserType] = useState<DashboardUserType>('unknown')
  const [baselineSeededThisSession, setBaselineSeededThisSession] = useState(false)
  const [demoSeededThisSession, setDemoSeededThisSession] = useState(false)
  const [confirmBaselineResetOpen, setConfirmBaselineResetOpen] = useState(false)
  const [confirmDemoResetOpen, setConfirmDemoResetOpen] = useState(false)
  const { user } = useAuth()

  const mode = props.mode ?? modeFromNodeEnv(process.env.NODE_ENV)

  useEffect(() => {
    if (!user?.userType) {
      if (userType !== 'unknown') setUserType('unknown')
      return
    }

    const nextType: DashboardUserType = isDashboardUserType(user.userType) ? user.userType : 'unknown'
    if (userType !== nextType) setUserType(nextType)
  }, [user?.userType, userType])

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchJSON('/api/seed')
      if (isSeedRunSummary(data)) setLastRun(data)
    } catch (_err) {
      // swallow: no prior run is fine
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  if (userType !== 'platform') return null

  const runSeed = useCallback(async (type: SeedRunType, opts?: { reset?: boolean }) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ type })
    if (opts?.reset) params.set('reset', '1')
    try {
      const data = await fetchJSON(`/api/seed?${params.toString()}`, { method: 'POST' })
      if (isSeedRunSummary(data)) {
        setLastRun(data)
        if (data.status === 'ok')
          toast.success(`${type} seed finished: ${data.totals.created} created / ${data.totals.updated} updated`)
        else if (data.status === 'partial') toast.warning(`Partial demo seed: ${data.partialFailures?.length} failures`) // baseline cannot be partial
        return data
      } else {
        toast.error('Seed failed: Unexpected response')
        setError('Unexpected response')
        return null
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      toast.error(`Seed failed: ${msg}`)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  const canReset = mode !== 'production'

  const onSeedBaseline = useCallback(async () => {
    if (canReset && baselineSeededThisSession) {
      setConfirmBaselineResetOpen(true)
      return
    }

    const result = await runSeed('baseline')
    if (result) setBaselineSeededThisSession(true)
  }, [baselineSeededThisSession, canReset, runSeed])

  const onConfirmBaselineReset = useCallback(async () => {
    setConfirmBaselineResetOpen(false)
    const result = await runSeed('baseline', { reset: true })
    if (result) setBaselineSeededThisSession(true)
  }, [runSeed])

  const onSeedDemo = useCallback(async () => {
    if (!demoSeededThisSession) {
      const result = await runSeed('demo')
      if (result) setDemoSeededThisSession(true)
      return
    }

    setConfirmDemoResetOpen(true)
  }, [demoSeededThisSession, runSeed])

  const onConfirmDemoReset = useCallback(async () => {
    setConfirmDemoResetOpen(false)
    const result = await runSeed('demo', { reset: true })
    if (result) setDemoSeededThisSession(true)
  }, [runSeed])

  const baselineButtonLabel = canReset && baselineSeededThisSession ? 'Reseed Baseline (Reset)' : 'Seed Baseline'
  const demoButtonLabel = demoSeededThisSession ? 'Reseed Demo (Reset)' : 'Seed Demo'

  return (
    <SeedingCardView
      mode={mode}
      userType={userType}
      loading={loading}
      error={error}
      lastRun={lastRun}
      baselineButtonLabel={baselineButtonLabel}
      demoButtonLabel={demoButtonLabel}
      onSeedBaseline={onSeedBaseline}
      onSeedDemo={onSeedDemo}
      onRefreshStatus={loadStatus}
      confirmBaselineResetOpen={confirmBaselineResetOpen}
      onConfirmBaselineResetOpenChange={setConfirmBaselineResetOpen}
      onConfirmBaselineReset={onConfirmBaselineReset}
      confirmDemoResetOpen={confirmDemoResetOpen}
      onConfirmDemoResetOpenChange={setConfirmDemoResetOpen}
      onConfirmDemoReset={onConfirmDemoReset}
    />
  )
}

export type { SeedRunSummary, SeedingCardMode, DashboardUserType } from './SeedingCardView'
export { SeedingCardView, getDemoSeedPolicy, modeFromNodeEnv } from './SeedingCardView'
