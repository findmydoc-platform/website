import type { Payload } from 'payload'
import { createStableIdResolvers } from '../utils/resolvers'
import { importCollection } from '../utils/import-collection'
import { importGlobals } from '../utils/import-globals'
import { baselinePlan } from '../utils/plan'
import { resetCollections } from '../utils/reset'

export type SeedUnitSummary = {
  name: string
  created: number
  updated: number
  warnings: string[]
  failures: string[]
}

export type SeedRunSummary = {
  units: SeedUnitSummary[]
  warnings: string[]
  failures: string[]
}

export async function runBaselineSeeds(payload: Payload, options: { reset?: boolean } = {}): Promise<SeedRunSummary> {
  const { reset = false } = options
  const resolvers = createStableIdResolvers(payload)
  const units: SeedUnitSummary[] = []
  const warnings: string[] = []
  const failures: string[] = []

  if (reset) {
    await resetCollections(payload, 'baseline')
  }

  for (const step of baselinePlan) {
    payload.logger.info(`Running baseline seed: ${step.name}`)

    try {
      if (step.kind === 'globals') {
        const result = await importGlobals(payload)
        units.push({ name: step.name, ...result })
        warnings.push(...result.warnings)
        failures.push(...result.failures)
        continue
      }

      const result = await importCollection({
        payload,
        kind: 'baseline',
        collection: step.collection,
        fileName: step.fileName,
        mapping: step.mapping,
        resolvers,
      })
      const { name: _ignoredName, ...rest } = result
      units.push({ name: step.name, ...rest })
      warnings.push(...result.warnings)
      failures.push(...result.failures)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Baseline seed ${step.name} failed: ${message}`)
    }
  }

  return { units, warnings, failures }
}
