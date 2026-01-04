'use client'
import React from 'react'
import { Button } from '@/components/atoms/button'

export type SeedingCardMode = 'development' | 'test' | 'production'

type SeedRunType = 'baseline' | 'demo'

export type DashboardUserType = 'platform' | 'clinic' | 'patient' | 'unknown'

interface SeedRunUnit {
  name: string
  created: number
  updated: number
}

export interface SeedRunSummary {
  type: SeedRunType
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

export const modeFromNodeEnv = (nodeEnv: string | undefined): SeedingCardMode => {
  if (nodeEnv === 'production') return 'production'
  if (nodeEnv === 'test') return 'test'
  return 'development'
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
  loading: boolean
  error: string | null
  lastRun: SeedRunSummary | null
  onRunSeed: (type: SeedRunType, opts?: { reset?: boolean }) => void
  onRefreshStatus: () => void
}

export const SeedingCardView: React.FC<SeedingCardViewProps> = (props) => {
  const { canRunDemo, disabledTitle } = getDemoSeedPolicy({ mode: props.mode, userType: props.userType })
  const isProd = props.mode === 'production'
  const lastRun = props.lastRun

  return (
    <div className="rounded-sm border border-border bg-card p-4">
      <h4>Seeding</h4>
      <div className="mb-2 mt-4 flex flex-wrap gap-4">
        <Button disabled={props.loading} onClick={() => props.onRunSeed('baseline')}>
          Seed Baseline
        </Button>
        {canRunDemo ? (
          <Button disabled={props.loading} onClick={() => props.onRunSeed('demo', { reset: true })}>
            Seed Demo (Reset)
          </Button>
        ) : (
          <Button disabled className="opacity-50" title={disabledTitle}>
            Seed Demo (Reset)
          </Button>
        )}
        <Button disabled={props.loading} onClick={props.onRefreshStatus}>
          Refresh Status
        </Button>
      </div>
      <small>
        Role: {props.userType} {isProd && '(production mode: demo disabled)'}
      </small>
      {props.error && <div className="text-error">Error: {props.error}</div>}
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
