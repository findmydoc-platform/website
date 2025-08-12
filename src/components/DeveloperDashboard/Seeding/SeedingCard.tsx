'use client'
import React, { useCallback, useEffect, useState } from 'react'
import styles from './SeedingCard.module.scss'
import { toast } from '@payloadcms/ui'
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

  // Lightweight userType discovery: attempt to read from global injected user (Payload admin usually exposes) else mark unknown
  useEffect(() => {
    const anyGlobal: any = window as any
    const adminUser = anyGlobal?.payload?.user || anyGlobal?.__CURRENT_USER__
    if (adminUser?.userType) setUserType(adminUser.userType)
  }, [])

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
    <div className={styles['seeding-card']}>
      <h4>Seeding</h4>
      <div className={styles.actions}>
        <Button disabled={loading} onClick={() => runSeed('baseline')}>
          Seed Baseline
        </Button>
        {canRunDemo ? (
          <Button disabled={loading} onClick={() => runSeed('demo', { reset: true })}>
            Seed Demo (Reset)
          </Button>
        ) : (
          <Button
            disabled
            className={styles.disabledHint}
            title={isProd ? 'Disabled in production' : 'Requires platform role'}
          >
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
      {error && <div className="error">Error: {error}</div>}
      {lastRun && (
        <div className={styles.status}>
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
          <details className={styles.unitsDetails}>
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
