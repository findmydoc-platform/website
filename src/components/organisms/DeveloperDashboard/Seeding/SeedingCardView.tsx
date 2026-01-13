'use client'
import React from 'react'
import { Button } from '@/components/atoms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'

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
  baselineButtonLabel: string
  demoButtonLabel: string
  onSeedBaseline: () => void
  onSeedDemo: () => void
  onRefreshStatus: () => void
  confirmBaselineResetOpen: boolean
  onConfirmBaselineResetOpenChange: (open: boolean) => void
  onConfirmBaselineReset: () => void
  confirmDemoResetOpen: boolean
  onConfirmDemoResetOpenChange: (open: boolean) => void
  onConfirmDemoReset: () => void
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

      <Dialog open={props.confirmBaselineResetOpen} onOpenChange={props.onConfirmBaselineResetOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset baseline seed?</DialogTitle>
            <DialogDescription>
              This will delete demo data first (posts, clinics, doctors, reviews, etc.), then delete baseline reference
              data (treatments, categories, tags, etc.), and finally re-seed baseline. Use only in non-production
              environments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              disabled={props.loading}
              onClick={() => props.onConfirmBaselineResetOpenChange(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={props.loading} onClick={props.onConfirmBaselineReset}>
              Confirm reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.confirmDemoResetOpen} onOpenChange={props.onConfirmDemoResetOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset demo seed?</DialogTitle>
            <DialogDescription>
              This will delete demo data (posts, clinics, doctors, reviews, etc.) and then re-seed it. Baseline
              reference data is not removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={props.loading} onClick={() => props.onConfirmDemoResetOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={props.loading} onClick={props.onConfirmDemoReset}>
              Confirm reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
