'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { ConfirmationModal, toast, useAuth, useModal } from '@payloadcms/ui'

import {
  SeedingCardView,
  modeFromRuntimeEnv,
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

  const hasValidWarnings =
    maybe.warnings === undefined ||
    (Array.isArray(maybe.warnings) && maybe.warnings.every((w) => typeof w === 'string'))
  const hasValidFailures =
    maybe.failures === undefined ||
    (Array.isArray(maybe.failures) && maybe.failures.every((f) => typeof f === 'string'))

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

export const SeedingCard: React.FC<{ mode?: SeedingCardMode }> = (props) => {
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<SeedRunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userType, setUserType] = useState<DashboardUserType>('unknown')
  const [baselineSeededThisSession, setBaselineSeededThisSession] = useState(false)
  const [demoSeededThisSession, setDemoSeededThisSession] = useState(false)
  const { user } = useAuth()
  const { openModal } = useModal()

  const mode =
    props.mode ?? modeFromRuntimeEnv({ nodeEnv: process.env.NODE_ENV, vercelEnv: process.env.NEXT_PUBLIC_VERCEL_ENV })
  const isPlatform = userType === 'platform'

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
      if (isSeedRunSummary(data)) {
        setLastRun(data)
        if (data.status === 'ok')
          toast.success(`${type} seed finished: ${data.totals.created} created / ${data.totals.updated} updated`)
        else if (data.status === 'partial')
          toast.warning(`Partial ${type} seed: ${(data.failures ?? []).length} failures`)
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

  if (!isPlatform) return null

  return (
    <>
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

export type { SeedRunSummary, SeedingCardMode, DashboardUserType } from './SeedingCardView'
export { SeedingCardView, getDemoSeedPolicy, modeFromNodeEnv, modeFromRuntimeEnv } from './SeedingCardView'
