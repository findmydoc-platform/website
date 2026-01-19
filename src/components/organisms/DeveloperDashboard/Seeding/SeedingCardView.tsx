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
  baselineButtonLabel: string
  demoButtonLabel: string
  onSeedBaseline: () => void
  onSeedDemo: () => void
  onRefreshStatus: () => void
}

export const SeedingCardView: React.FC<SeedingCardViewProps> = (props) => {
  const { canRunDemo, disabledTitle } = getDemoSeedPolicy({ mode: props.mode, userType: props.userType })
  const isProd = props.mode === 'production'
  const lastRun = props.lastRun

  return (
    <div className="border-border bg-card rounded-sm border p-4">
      <h4>Seeding</h4>
      <div className="border-destructive/30 bg-destructive/10 text-destructive mt-2 rounded-sm border p-3 text-sm">
        These actions may be destructive. In particular, a baseline reset will also delete demo data first to avoid
        integrity issues.
      </div>
      <div className="mt-4 mb-2 flex flex-wrap gap-4">
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
          {lastRun.warnings?.length ? (
            <details>
              <summary>Warnings ({lastRun.warnings.length})</summary>
              <ul>
                {lastRun.warnings.map((w, idx) => (
                  <li key={idx}>{w}</li>
                ))}
              </ul>
            </details>
          ) : null}
          {lastRun.failures?.length ? (
            <details>
              <summary>Failures ({lastRun.failures.length})</summary>
              <ul>
                {lastRun.failures.map((f, idx) => (
                  <li key={idx}>{f}</li>
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
