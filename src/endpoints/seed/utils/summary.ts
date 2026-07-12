import type { SeedUnitSummary } from '../baseline/run-baseline'

export type SeedStatus = 'ok' | 'partial' | 'failed'

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
