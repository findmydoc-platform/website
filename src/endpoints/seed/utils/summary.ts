import type { SeedRunSummary as SeedExecutionSummary, SeedUnitSummary } from '../baseline/run-baseline'
import type { SeedType } from './runtime'

export type SeedStatus = 'ok' | 'partial' | 'failed'

export type SeedRunSummaryView = {
  type: SeedType
  reset: boolean
  status: SeedStatus
  startedAt: string
  finishedAt: string
  durationMs: number
  totals: { created: number; updated: number }
  units: SeedUnitSummary[]
  warnings: string[]
  failures: string[]
}

export function sumSeedUnits(units: Pick<SeedUnitSummary, 'created' | 'updated'>[]): {
  created: number
  updated: number
} {
  return units.reduce(
    (acc, unit) => {
      acc.created += unit.created
      acc.updated += unit.updated
      return acc
    },
    { created: 0, updated: 0 },
  )
}

/**
 * Determine a seed run status from units and failures.
 *
 * Rules:
 * - If there are no failures, status is 'ok'.
 * - If there are failures and there are units processed, status is 'partial'.
 * - If there are failures and no units were processed, status is 'failed'.
 */
export function determineSeedStatus(
  units: Pick<SeedUnitSummary, 'created' | 'updated'>[],
  failures: string[],
): SeedStatus {
  if (Array.isArray(failures) && failures.length > 0) {
    return Array.isArray(units) && units.length > 0 ? 'partial' : 'failed'
  }
  return 'ok'
}

export function buildSeedSummary(args: {
  type: SeedType
  reset: boolean
  startedAtMs: number
  result: SeedExecutionSummary
}): SeedRunSummaryView {
  const finishedAtMs = Date.now()
  const totals = sumSeedUnits(args.result.units)
  const status = determineSeedStatus(args.result.units, args.result.failures)

  return {
    type: args.type,
    reset: args.reset,
    status,
    startedAt: new Date(args.startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - args.startedAtMs,
    totals,
    units: args.result.units,
    warnings: args.result.warnings,
    failures: args.result.failures,
  }
}
