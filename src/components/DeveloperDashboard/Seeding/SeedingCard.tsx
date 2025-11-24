'use client'
import React, { useCallback, useEffect, useState } from 'react'
import { toast, useAuth } from '@payloadcms/ui'
import { Button } from '@/components/ui/button'

interface SeedRunUnit {
  name: string
  created: number
  updated: number
}
interface SeedRunSummary {
  type: 'baseline' | 'demo'
  reset?: boolean
  status: 'ok' | 'partial' | 'failed'
  baselineFailed: boolean
  startedAt: string
  finishedAt: string
  durationMs: number
  totals: { created: number; updated: number }
  units: SeedRunUnit[]
  partialFailures?: { name: string; error: string }[]
  beforeCounts?: Record<string, number>
  afterCounts?: Record<string, number>
}

const fetchJSON = async (url: string, opts?: RequestInit) => {
  const res = await fetch(url, { credentials: 'include', ...opts })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export const SeedingCard: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [lastRun, setLastRun] = useState<SeedRunSummary | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [userType, setUserType] = useState<string | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    if (user?.userType && userType !== user.userType) setUserType(user.userType)
  }, [user?.userType, userType])

  const loadStatus = useCallback(async () => {
    try {
      const data = await fetchJSON('/api/seed')
      if (data && data.startedAt) setLastRun(data)
    } catch (_err) {
      // swallow: no prior run is fine
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const runSeed = useCallback(async (type: 'baseline' | 'demo', opts?: { reset?: boolean }) => {
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ type })
    if (opts?.reset) params.set('reset', '1')
    try {
      const data: SeedRunSummary = await fetchJSON(`/api/seed?${params.toString()}`, { method: 'POST' })
      setLastRun(data)
      if (data.status === 'ok')
        toast.success(`${type} seed finished: ${data.totals.created} created / ${data.totals.updated} updated`)
      else if (data.status === 'partial') toast.warning(`Partial demo seed: ${data.partialFailures?.length} failures`) // baseline cannot be partial
    } catch (e: any) {
      setError(e.message)
      toast.error(`Seed failed: ${e.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const isProd = process.env.NODE_ENV === 'production'
  const canRunDemo = userType === 'platform' && !isProd

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <h4>Seeding</h4>
      <div className="mb-2 mt-4 flex flex-wrap gap-4">
        <Button disabled={loading} onClick={() => runSeed('baseline')}>
          Seed Baseline
        </Button>
        {canRunDemo ? (
          <Button disabled={loading} onClick={() => runSeed('demo', { reset: true })}>
            Seed Demo (Reset)
          </Button>
        ) : (
          <Button disabled className="opacity-50" title={isProd ? 'Disabled in production' : 'Requires platform role'}>
            Seed Demo (Reset)
          </Button>
        )}
        <Button disabled={loading} onClick={loadStatus}>
          Refresh Status
        </Button>
      </div>
      <small>
        {userType ? `Role: ${userType}` : 'Role: unknown'} {isProd && '(production mode: demo disabled)'}
      </small>
      {error && <div className="text-error">Error: {error}</div>}
      {lastRun && (
        <div className="mt-4">
          <div>
            Last Run: {new Date(lastRun.finishedAt).toLocaleTimeString()} ({lastRun.type}
            {lastRun.reset ? ' + reset' : ''}) status: {lastRun.status}
          </div>
          <div>
            Totals: created {lastRun.totals.created}, updated {lastRun.totals.updated}
          </div>
          {lastRun.beforeCounts && lastRun.afterCounts && (
            <details>
              <summary>Reset Counts</summary>
              <ul>
                {Object.keys(lastRun.beforeCounts).map((c) => (
                  <li key={c}>
                    {c}: {lastRun.beforeCounts?.[c]} → {lastRun.afterCounts?.[c]}
                  </li>
                ))}
              </ul>
            </details>
          )}
          {lastRun.partialFailures?.length ? (
            <details>
              <summary>Partial Failures ({lastRun.partialFailures.length})</summary>
              <ul>
                {lastRun.partialFailures.map((f) => (
                  <li key={f.name}>
                    {f.name}: {f.error}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          <details className="mt-2">
            <summary>Units</summary>
            <ul>
              {lastRun.units.map((u) => (
                <li key={u.name}>
                  {u.name}: +{u.created} / ~{u.updated}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  )
}
